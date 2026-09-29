import "server-only";

import Stripe from "stripe";

import { getPayPalAccessToken, getPayPalBaseUrl } from "@/lib/payments/paypal";
import { usesDummyCredential } from "@/lib/payments/shared";
import { decimalToMinorUnits } from "@/lib/payments/amounts";
import type { PaymentMethodCode } from "@/types";

export type ProviderOrder = {
  id: string;
  currency: string;
  total: number;
  paymentMethod: PaymentMethodCode;
  paymentRef: string | null;
  providerCheckoutId: string | null;
  paymentExpiresAt: Date | null;
};

export type ProviderCheckoutState =
  | { state: "paid"; paymentRef: string }
  | { state: "expired" }
  | { state: "active" }
  | { state: "unknown"; message: string };

export type ProviderRefundState =
  | { state: "succeeded"; providerRef: string }
  | { state: "pending"; providerRef: string }
  | { state: "failed"; message: string }
  | { state: "needs_review"; message: string };

export type ProviderRefund = {
  orderId: string;
  provider: PaymentMethodCode;
  providerRef: string;
  amount: number;
  currency: string;
  paymentRef: string | null;
};

export function isSupportedPaymentMethod(
  value: string | null,
): value is PaymentMethodCode {
  return value === "STRIPE" || value === "MOYASAR" || value === "PAYPAL";
}

type PayPalCapture = {
  id?: string;
  status?: string;
  amount?: { currency_code?: string; value?: string };
};

type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    custom_id?: string;
    reference_id?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: { captures?: PayPalCapture[] };
  }>;
};

type MoyasarPayment = {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  refunded?: number;
};

type MoyasarInvoice = {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  expired_at?: string | null;
  metadata?: { orderId?: string };
  payments?: MoyasarPayment[];
};

const requestTimeout = 15_000;

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (usesDummyCredential(key)) throw new Error("Stripe is not configured");
  return new Stripe(key as string);
}

function moyasarHeaders() {
  const key = process.env.MOYASAR_SECRET_KEY;
  if (usesDummyCredential(key)) throw new Error("Moyasar is not configured");
  return {
    Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

async function getPayPalOrder(checkoutId: string) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(
    `${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(checkoutId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeout),
    },
  );
  if (response.status === 404 || response.status === 422) return null;
  if (!response.ok) throw new Error(`PayPal order lookup failed (${response.status})`);
  return (await response.json()) as PayPalOrder;
}

async function getMoyasarInvoice(checkoutId: string) {
  const response = await fetch(
    `https://api.moyasar.com/v1/invoices/${encodeURIComponent(checkoutId)}`,
    {
      headers: moyasarHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeout),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Moyasar invoice lookup failed (${response.status})`);
  return (await response.json()) as MoyasarInvoice;
}

function validatePayPalOrder(order: ProviderOrder, remote: PayPalOrder) {
  const unit = remote.purchase_units?.[0];
  const linkedOrderId = unit?.custom_id ?? unit?.reference_id;
  return linkedOrderId === order.id &&
    unit?.amount?.currency_code === order.currency &&
    Boolean(unit.amount.value) &&
    decimalToMinorUnits(unit.amount.value as string) === order.total;
}

function completedPayPalCapture(remote: PayPalOrder) {
  return remote.purchase_units
    ?.flatMap((unit) => unit.payments?.captures ?? [])
    .find((capture) => capture.status === "COMPLETED" && capture.id);
}

function paidMoyasarPayment(remote: MoyasarInvoice) {
  return remote.payments?.find((payment) =>
    (payment.status === "paid" || payment.status === "captured") && payment.id,
  );
}

function validateMoyasarInvoice(order: ProviderOrder, remote: MoyasarInvoice) {
  return remote.metadata?.orderId === order.id &&
    remote.amount === order.total &&
    remote.currency === order.currency;
}

export async function inspectProviderCheckout(
  order: ProviderOrder,
): Promise<ProviderCheckoutState> {
  const checkoutId = order.providerCheckoutId;
  if (!checkoutId) return { state: "unknown", message: "Missing provider checkout ID" };

  try {
    if (order.paymentMethod === "STRIPE") {
      const session = await stripeClient().checkout.sessions.retrieve(checkoutId);
      const valid = session.client_reference_id === order.id &&
        session.metadata?.orderId === order.id &&
        session.amount_total === order.total &&
        session.currency?.toUpperCase() === order.currency;
      if (!valid) return { state: "unknown", message: "Stripe checkout details do not match the order" };
      if (session.payment_status === "paid") {
        const paymentRef = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
        return paymentRef
          ? { state: "paid", paymentRef }
          : { state: "unknown", message: "Stripe payment has no PaymentIntent reference" };
      }
      if (session.status === "expired") return { state: "expired" };
      return { state: "active" };
    }

    if (order.paymentMethod === "PAYPAL") {
      const remote = await getPayPalOrder(checkoutId);
      if (!remote) {
        return order.paymentExpiresAt && order.paymentExpiresAt <= new Date()
          ? { state: "expired" }
          : { state: "unknown", message: "PayPal order was not found" };
      }
      if (!validatePayPalOrder(order, remote)) {
        return { state: "unknown", message: "PayPal checkout details do not match the order" };
      }
      const capture = completedPayPalCapture(remote);
      if (remote.status === "COMPLETED" && capture?.id) {
        return { state: "paid", paymentRef: capture.id };
      }
      if (remote.status === "CREATED" && order.paymentExpiresAt && order.paymentExpiresAt <= new Date()) {
        return { state: "expired" };
      }
      return { state: "active" };
    }

    const remote = await getMoyasarInvoice(checkoutId);
    if (!remote) return { state: "unknown", message: "Moyasar invoice was not found" };
    if (!validateMoyasarInvoice(order, remote)) {
      return { state: "unknown", message: "Moyasar invoice details do not match the order" };
    }
    const payment = paidMoyasarPayment(remote);
    if (remote.status === "paid" && payment?.id) {
      return { state: "paid", paymentRef: payment.id };
    }
    if (["expired", "canceled", "failed", "voided"].includes(remote.status ?? "")) {
      return { state: "expired" };
    }
    return { state: "active" };
  } catch (error) {
    return {
      state: "unknown",
      message: error instanceof Error ? error.message : "Provider lookup failed",
    };
  }
}

export async function cancelProviderCheckout(
  order: ProviderOrder,
): Promise<ProviderCheckoutState> {
  const inspected = await inspectProviderCheckout(order);
  if (inspected.state !== "active") return inspected;
  const checkoutId = order.providerCheckoutId;
  if (!checkoutId) return { state: "unknown", message: "Missing provider checkout ID" };

  try {
    if (order.paymentMethod === "STRIPE") {
      await stripeClient().checkout.sessions.expire(checkoutId);
      return { state: "expired" };
    }
    if (order.paymentMethod === "MOYASAR") {
      const response = await fetch(
        `https://api.moyasar.com/v1/invoices/${encodeURIComponent(checkoutId)}/cancel`,
        {
          method: "PUT",
          headers: moyasarHeaders(),
          signal: AbortSignal.timeout(requestTimeout),
        },
      );
      if (!response.ok) return { state: "unknown", message: `Moyasar cancellation failed (${response.status})` };
      const invoice = (await response.json()) as MoyasarInvoice;
      return invoice.status === "canceled" || invoice.status === "expired"
        ? { state: "expired" }
        : { state: "unknown", message: `Unexpected Moyasar invoice status: ${invoice.status ?? "unknown"}` };
    }
    return { state: "active" };
  } catch (error) {
    return {
      state: "unknown",
      message: error instanceof Error ? error.message : "Provider cancellation failed",
    };
  }
}

async function resolveStripePaymentIntent(order: ProviderOrder) {
  if (order.paymentRef?.startsWith("pi_")) return order.paymentRef;
  const checkoutId = order.providerCheckoutId ??
    (order.paymentRef?.startsWith("cs_") ? order.paymentRef : null);
  if (!checkoutId) return null;
  const session = await stripeClient().checkout.sessions.retrieve(checkoutId);
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
}

async function resolvePayPalCapture(order: ProviderOrder) {
  if (order.providerCheckoutId) {
    const remote = await getPayPalOrder(order.providerCheckoutId);
    return remote ? completedPayPalCapture(remote)?.id ?? null : null;
  }
  if (!order.paymentRef) return null;
  const legacyOrder = await getPayPalOrder(order.paymentRef);
  return legacyOrder ? completedPayPalCapture(legacyOrder)?.id ?? null : order.paymentRef;
}

export async function refundProviderPayment(
  order: ProviderOrder,
): Promise<ProviderRefundState> {
  try {
    if (order.paymentMethod === "STRIPE") {
      const paymentIntent = await resolveStripePaymentIntent(order);
      if (!paymentIntent) return { state: "failed", message: "Stripe PaymentIntent was not found" };
      const refund = await stripeClient().refunds.create(
        {
          payment_intent: paymentIntent,
          amount: order.total,
          reason: "requested_by_customer",
          metadata: { orderId: order.id },
        },
        { idempotencyKey: `order-refund:${order.id}:v1` },
      );
      if (refund.status === "succeeded") return { state: "succeeded", providerRef: refund.id };
      if (refund.status === "pending") return { state: "pending", providerRef: refund.id };
      return { state: "failed", message: `Stripe refund status: ${refund.status ?? "unknown"}` };
    }

    if (order.paymentMethod === "PAYPAL") {
      const captureId = await resolvePayPalCapture(order);
      if (!captureId) return { state: "failed", message: "PayPal capture was not found" };
      const accessToken = await getPayPalAccessToken();
      const response = await fetch(
        `${getPayPalBaseUrl()}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": `order-refund:${order.id}:v1`,
            Prefer: "return=representation",
          },
          body: "{}",
          signal: AbortSignal.timeout(requestTimeout),
        },
      );
      if (!response.ok) return { state: "failed", message: `PayPal refund failed (${response.status})` };
      const refund = (await response.json()) as { id?: string; status?: string };
      if (!refund.id) return { state: "failed", message: "PayPal refund returned no reference" };
      if (refund.status === "COMPLETED") return { state: "succeeded", providerRef: refund.id };
      if (refund.status === "PENDING") return { state: "pending", providerRef: refund.id };
      return { state: "failed", message: `PayPal refund status: ${refund.status ?? "unknown"}` };
    }

    if (!order.paymentRef) return { state: "failed", message: "Moyasar payment reference was not found" };
    let response: Response;
    try {
      response = await fetch(
        `https://api.moyasar.com/v1/payments/${encodeURIComponent(order.paymentRef)}/refund`,
        {
          method: "POST",
          headers: moyasarHeaders(),
          body: JSON.stringify({ amount: order.total }),
          signal: AbortSignal.timeout(requestTimeout),
        },
      );
    } catch (error) {
      return {
        state: "needs_review",
        message: error instanceof Error
          ? `Moyasar refund outcome is unknown: ${error.message}`
          : "Moyasar refund outcome is unknown",
      };
    }
    if (!response.ok) return { state: "failed", message: `Moyasar refund failed (${response.status})` };
    const payment = (await response.json()) as MoyasarPayment;
    if (payment.status === "refunded" && (payment.refunded ?? 0) >= order.total) {
      return { state: "succeeded", providerRef: payment.id ?? order.paymentRef };
    }
    return { state: "needs_review", message: `Moyasar refund status: ${payment.status ?? "unknown"}` };
  } catch (error) {
    return {
      state: "failed",
      message: error instanceof Error ? error.message : "Refund request failed",
    };
  }
}

export async function inspectProviderRefund(
  refund: ProviderRefund,
): Promise<ProviderRefundState> {
  try {
    if (refund.provider === "STRIPE") {
      const remote = await stripeClient().refunds.retrieve(refund.providerRef);
      if (
        remote.metadata?.orderId !== refund.orderId ||
        remote.amount !== refund.amount ||
        remote.currency.toUpperCase() !== refund.currency
      ) {
        return { state: "needs_review", message: "Stripe refund details do not match" };
      }
      if (remote.status === "succeeded") {
        return { state: "succeeded", providerRef: remote.id };
      }
      if (remote.status === "pending") {
        return { state: "pending", providerRef: remote.id };
      }
      return { state: "failed", message: `Stripe refund status: ${remote.status ?? "unknown"}` };
    }

    if (refund.provider === "PAYPAL") {
      const accessToken = await getPayPalAccessToken();
      const response = await fetch(
        `${getPayPalBaseUrl()}/v2/payments/refunds/${encodeURIComponent(refund.providerRef)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: AbortSignal.timeout(requestTimeout),
        },
      );
      if (!response.ok) {
        return { state: "needs_review", message: `PayPal refund lookup failed (${response.status})` };
      }
      const remote = (await response.json()) as {
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      };
      if (
        remote.id !== refund.providerRef ||
        remote.amount?.currency_code !== refund.currency ||
        !remote.amount.value ||
        decimalToMinorUnits(remote.amount.value) !== refund.amount
      ) {
        return { state: "needs_review", message: "PayPal refund details do not match" };
      }
      if (remote.status === "COMPLETED") {
        return { state: "succeeded", providerRef: remote.id };
      }
      if (remote.status === "PENDING") {
        return { state: "pending", providerRef: remote.id };
      }
      return { state: "failed", message: `PayPal refund status: ${remote.status ?? "unknown"}` };
    }

    if (!refund.paymentRef) {
      return { state: "needs_review", message: "Moyasar payment reference is missing" };
    }
    const response = await fetch(
      `https://api.moyasar.com/v1/payments/${encodeURIComponent(refund.paymentRef)}`,
      {
        headers: moyasarHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeout),
      },
    );
    if (!response.ok) {
      return { state: "needs_review", message: `Moyasar refund lookup failed (${response.status})` };
    }
    const payment = (await response.json()) as MoyasarPayment;
    if (
      payment.id !== refund.paymentRef ||
      payment.currency !== refund.currency ||
      payment.amount !== refund.amount
    ) {
      return { state: "needs_review", message: "Moyasar refund details do not match" };
    }
    if (payment.status === "refunded" && (payment.refunded ?? 0) >= refund.amount) {
      return { state: "succeeded", providerRef: payment.id };
    }
    return { state: "pending", providerRef: refund.providerRef };
  } catch (error) {
    return {
      state: "needs_review",
      message: error instanceof Error ? error.message : "Refund lookup failed",
    };
  }
}
