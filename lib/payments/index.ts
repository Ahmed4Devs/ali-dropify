import "server-only";

import { moyasarAdapter } from "@/lib/payments/moyasar";
import { paypalAdapter } from "@/lib/payments/paypal";
import { stripeAdapter } from "@/lib/payments/stripe";
import type { PaymentAdapter, PaymentMethodCode } from "@/types";
import { usesDummyCredential } from "@/lib/payments/shared";

export function assertPaymentMethodConfigured(method: PaymentMethodCode) {
  if (process.env.NODE_ENV !== "production") return;
  const credentials: Record<PaymentMethodCode, Array<string | undefined>> = {
    STRIPE: [process.env.STRIPE_SECRET_KEY],
    MOYASAR: [process.env.MOYASAR_SECRET_KEY],
    PAYPAL: [process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET],
  };
  const labels: Record<PaymentMethodCode, string> = {
    STRIPE: "Stripe",
    MOYASAR: "Moyasar",
    PAYPAL: "PayPal",
  };
  const hasInvalidCredential = credentials[method].some((credential) =>
    usesDummyCredential(credential) || credential === "000000"
  );
  if (hasInvalidCredential) throw new Error(`${labels[method]} is not configured`);
}

export function getPaymentAdapter(method: PaymentMethodCode): PaymentAdapter {
  if (method === "MOYASAR") return moyasarAdapter;
  if (method === "PAYPAL") return paypalAdapter;
  return stripeAdapter;
}
