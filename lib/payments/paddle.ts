import "server-only";

import { PaymentCreationUncertainError } from "@/lib/payments/errors";
import { markOrderPaid, usesDummyCredential } from "@/lib/payments/shared";
import type { PaymentAdapter } from "@/types";

const requestTimeout = 15_000;

export function getPaddleBaseUrl() {
  return process.env.PADDLE_ENV === "live"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

export function getPaddleHeaders() {
  const key = process.env.PADDLE_API_KEY;
  if (usesDummyCredential(key)) throw new Error("Paddle is not configured");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export const paddleAdapter: PaymentAdapter = {
  async createPayment(order) {
    if (order.currency === "SAR") throw new Error("Paddle is not available for SAR");
    const key = process.env.PADDLE_API_KEY;
    const productId = process.env.PADDLE_PRODUCT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    if (usesDummyCredential(key) || usesDummyCredential(productId)) {
      if (process.env.NODE_ENV === "production") throw new Error("Paddle is not configured");
      const paymentRef = `dev-paddle-${order.id}`;
      await markOrderPaid(order.id, "PADDLE", paymentRef);
      return {
        redirectUrl: `${appUrl}/${order.locale}/checkout/success?order=${order.id}`,
        paymentRef,
        paidInDevelopment: true,
      };
    }

    const expiresAt = new Date(Date.now() + 31 * 60_000);
    let response: Response;
    try {
      response = await fetch(`${getPaddleBaseUrl()}/transactions`, {
        method: "POST",
        headers: getPaddleHeaders(),
        body: JSON.stringify({
          items: [{
            quantity: 1,
            price: {
              description: `Order ${order.orderNumber}`,
              name: `Order ${order.orderNumber}`,
              billing_cycle: null,
              tax_mode: "internal",
              unit_price: {
                amount: String(order.total),
                currency_code: order.currency,
              },
              product_id: productId,
            },
          }],
          collection_mode: "automatic",
          custom_data: {
            orderId: order.id,
            expectedTotal: String(order.total),
            currency: order.currency,
          },
          checkout: {
            url: `${appUrl}/${order.locale}/checkout/paddle/${order.id}`,
          },
        }),
        signal: AbortSignal.timeout(requestTimeout),
      });
    } catch (error) {
      throw new PaymentCreationUncertainError(
        "Paddle transaction creation outcome is unknown",
        { cause: error },
      );
    }

    if (!response.ok) {
      const retryIsUnsafe = response.status >= 500 || [408, 409, 425, 429].includes(response.status);
      if (retryIsUnsafe) {
        throw new PaymentCreationUncertainError(
          `Paddle transaction creation outcome is unknown (${response.status})`,
        );
      }
      throw new Error(`Paddle transaction creation failed (${response.status})`);
    }

    let transaction: {
      data?: {
        id?: string;
        currency_code?: string;
        custom_data?: { orderId?: string; expectedTotal?: string };
        checkout?: { url?: string | null } | null;
        details?: { totals?: { grand_total?: string } };
      };
    };
    try {
      transaction = await response.json() as typeof transaction;
    } catch (error) {
      throw new PaymentCreationUncertainError(
        "Paddle created a transaction but returned an unreadable response",
        { cause: error },
      );
    }
    const remote = transaction.data;
    if (!remote?.id || !remote.checkout?.url) {
      throw new PaymentCreationUncertainError(
        "Paddle created a transaction without complete checkout details",
      );
    }
    if (
      remote.custom_data?.orderId !== order.id ||
      remote.custom_data.expectedTotal !== String(order.total) ||
      remote.currency_code !== order.currency ||
      remote.details?.totals?.grand_total !== String(order.total)
    ) {
      throw new PaymentCreationUncertainError("Paddle checkout details do not match the order");
    }
    return {
      redirectUrl: remote.checkout.url,
      checkoutId: remote.id,
      expiresAt,
    };
  },
};
