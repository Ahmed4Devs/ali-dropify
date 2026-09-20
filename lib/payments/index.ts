import "server-only";

import { moyasarAdapter } from "@/lib/payments/moyasar";
import { lemonSqueezyAdapter } from "@/lib/payments/lemonsqueezy";
import { paddleAdapter } from "@/lib/payments/paddle";
import { paypalAdapter } from "@/lib/payments/paypal";
import { stripeAdapter } from "@/lib/payments/stripe";
import type { PaymentAdapter, PaymentMethodCode } from "@/types";
import { usesDummyCredential } from "@/lib/payments/shared";

export function assertPaymentMethodConfigured(method: PaymentMethodCode) {
  if (method === "PADDLE" && process.env.NEXT_PUBLIC_PADDLE_ENABLED !== "true") {
    throw new Error("Paddle is not configured");
  }
  if (method === "LEMONSQUEEZY" && process.env.NEXT_PUBLIC_LEMONSQUEEZY_ENABLED !== "true") {
    throw new Error("Lemon Squeezy is not configured");
  }
  if (process.env.NODE_ENV !== "production") return;
  const credentials: Record<PaymentMethodCode, Array<string | undefined>> = {
    STRIPE: [process.env.STRIPE_SECRET_KEY],
    MOYASAR: [process.env.MOYASAR_SECRET_KEY],
    PAYPAL: [process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET],
    PADDLE: [
      process.env.PADDLE_API_KEY,
      process.env.PADDLE_PRODUCT_ID,
      process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    ],
    LEMONSQUEEZY: [
      process.env.LEMONSQUEEZY_API_KEY,
      process.env.LEMONSQUEEZY_STORE_ID,
      process.env.LEMONSQUEEZY_VARIANT_ID,
    ],
  };
  const labels: Record<PaymentMethodCode, string> = {
    STRIPE: "Stripe",
    MOYASAR: "Moyasar",
    PAYPAL: "PayPal",
    PADDLE: "Paddle",
    LEMONSQUEEZY: "Lemon Squeezy",
  };
  const hasInvalidCredential = credentials[method].some((credential) =>
    usesDummyCredential(credential) || credential === "000000"
  );
  if (hasInvalidCredential) throw new Error(`${labels[method]} is not configured`);
}

export function getPaymentAdapter(method: PaymentMethodCode): PaymentAdapter {
  if (method === "MOYASAR") return moyasarAdapter;
  if (method === "PAYPAL") return paypalAdapter;
  if (method === "PADDLE") return paddleAdapter;
  if (method === "LEMONSQUEEZY") return lemonSqueezyAdapter;
  return stripeAdapter;
}
