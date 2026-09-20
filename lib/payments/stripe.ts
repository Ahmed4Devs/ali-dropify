import "server-only";

import Stripe from "stripe";
import { markOrderPaid, usesDummyCredential } from "@/lib/payments/shared";
import type { PaymentAdapter } from "@/types";

export const stripeAdapter: PaymentAdapter = {
  async createPayment(order) {
    const key = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    if (usesDummyCredential(key)) {
      if (process.env.NODE_ENV === "production") throw new Error("Stripe is not configured");
      const paymentRef = `dev-stripe-${order.id}`;
      await markOrderPaid(order.id, "STRIPE", paymentRef);
      return {
        redirectUrl: `${appUrl}/${order.locale}/checkout/success?order=${order.id}`,
        paymentRef,
        paidInDevelopment: true,
      };
    }
    const stripe = new Stripe(key as string);
    const expiresAt = new Date(Date.now() + 31 * 60_000);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: order.email,
      currency: order.currency.toLowerCase(),
      client_reference_id: order.id,
      line_items: [
        ...order.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: item.unitPrice,
            product_data: {
              name: item.title,
              images: item.image?.startsWith("https://") ? [item.image] : undefined,
            },
          },
        })),
        ...(order.shippingFee > 0
          ? [{
              quantity: 1,
              price_data: {
                currency: order.currency.toLowerCase(),
                unit_amount: order.shippingFee,
                product_data: { name: "Shipping" },
              },
            }]
          : []),
      ],
      metadata: { orderId: order.id, expectedTotal: String(order.total) },
      expires_at: Math.floor(expiresAt.getTime() / 1_000),
      success_url: `${appUrl}/${order.locale}/checkout/success?order=${order.id}`,
      cancel_url: `${appUrl}/${order.locale}/checkout?payment=cancelled`,
    }, { idempotencyKey: `checkout:${order.id}:stripe:v1` });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { redirectUrl: session.url, checkoutId: session.id, expiresAt };
  },
};
