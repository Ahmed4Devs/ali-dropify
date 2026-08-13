import Stripe from "stripe";
import { markOrderPaid, usesDummyCredential } from "@/lib/payments/shared";

export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (usesDummyCredential(key) || usesDummyCredential(secret)) {
    return Response.json({ error: "Stripe webhook is not configured" }, { status: 400 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });
  try {
    const stripe = new Stripe(key as string);
    const event = stripe.webhooks.constructEvent(await request.text(), signature, secret as string);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      const expectedTotal = Number(session.metadata?.expectedTotal);
      const amountMatches = Number.isInteger(expectedTotal) && session.amount_total === expectedTotal;
      const order = orderId
        ? await (await import("@/lib/prisma")).prisma.order.findUnique({ where: { id: orderId } })
        : null;
      if (
        orderId &&
        order &&
        session.payment_status === "paid" &&
        amountMatches &&
        order.total === session.amount_total &&
        order.currency.toLowerCase() === session.currency
      ) {
        await markOrderPaid(orderId, "STRIPE", String(session.payment_intent ?? session.id));
      } else if (orderId) {
        console.error("Stripe checkout total or currency did not match the order", {
          orderId,
          amountTotal: session.amount_total,
          currency: session.currency,
        });
      }
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook verification failed", error);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
}
