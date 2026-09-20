import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { claimPaymentEvent, finishPaymentEvent } from "@/lib/payments/events";
import { reconcilePendingOrder } from "@/lib/payments/lifecycle";
import { completeRefund } from "@/lib/payments/refunds";
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
    let orderId: string | null = null;
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
      orderId = event.data.object.metadata?.orderId ?? null;
    } else if (event.type === "refund.updated") {
      orderId = event.data.object.metadata?.orderId ?? null;
    }
    const eventRecordId = await claimPaymentEvent({
      provider: "STRIPE",
      externalId: event.id,
      type: event.type,
      orderId,
    });
    if (!eventRecordId) return Response.json({ received: true, duplicate: true });

    try {
      if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const completedOrderId = session.metadata?.orderId;
      const expectedTotal = Number(session.metadata?.expectedTotal);
      const amountMatches = Number.isInteger(expectedTotal) && session.amount_total === expectedTotal;
      const order = completedOrderId
        ? await prisma.order.findUnique({ where: { id: completedOrderId } })
        : null;
      if (
        completedOrderId &&
        order &&
        session.payment_status === "paid" &&
        amountMatches &&
        order.total === session.amount_total &&
        order.currency.toLowerCase() === session.currency
      ) {
        const paymentRef = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
        if (!paymentRef) throw new Error("Stripe checkout has no PaymentIntent reference");
        await markOrderPaid(completedOrderId, "STRIPE", paymentRef);
      } else {
        throw new Error("Stripe checkout total, currency, or order metadata did not match");
      }
      } else if (event.type === "checkout.session.expired") {
        const session = event.data.object;
        const expiredOrder = await prisma.order.findUnique({
          where: { providerCheckoutId: session.id },
          select: { id: true },
        });
        if (expiredOrder) await reconcilePendingOrder(expiredOrder.id, { cancel: true, force: true });
      } else if (event.type === "refund.updated") {
        const refund = event.data.object;
        const refundOrderId = refund.metadata?.orderId;
        if (refund.status === "succeeded" && refundOrderId) {
          await completeRefund(refundOrderId, refund.id);
        }
      } else {
        await finishPaymentEvent(eventRecordId, "IGNORED");
        return Response.json({ received: true });
      }
      await finishPaymentEvent(eventRecordId, "PROCESSED");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe event processing failed";
      await finishPaymentEvent(eventRecordId, "FAILED", message);
      console.error("Stripe webhook processing failed", { eventId: event.id, message });
      return Response.json({ error: "Event processing failed" }, { status: 500 });
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook verification failed", error);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
}
