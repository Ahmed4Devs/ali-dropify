import "server-only";

import { moyasarAdapter } from "@/lib/payments/moyasar";
import { paypalAdapter } from "@/lib/payments/paypal";
import { stripeAdapter } from "@/lib/payments/stripe";
import type { PaymentAdapter, PaymentMethodCode } from "@/types";
import { usesDummyCredential } from "@/lib/payments/shared";

export function assertPaymentMethodConfigured(method: PaymentMethodCode) {
  if (process.env.NODE_ENV !== "production") return;
  const credential = method === "STRIPE"
    ? process.env.STRIPE_SECRET_KEY
    : method === "MOYASAR"
      ? process.env.MOYASAR_SECRET_KEY
      : process.env.PAYPAL_CLIENT_ID;
  if (usesDummyCredential(credential)) throw new Error(`${method} is not configured`);
}

export function getPaymentAdapter(method: PaymentMethodCode): PaymentAdapter {
  if (method === "MOYASAR") return moyasarAdapter;
  if (method === "PAYPAL") return paypalAdapter;
  return stripeAdapter;
}
