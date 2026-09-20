import { claimPaymentEvent, finishPaymentEvent } from "@/lib/payments/events";
import { reconcilePendingOrder } from "@/lib/payments/lifecycle";
import { completeRefund } from "@/lib/payments/refunds";
import { markOrderPaid, usesDummyCredential } from "@/lib/payments/shared";
import { verifyPaddleSignature } from "@/lib/payments/webhook-signatures";
import { prisma } from "@/lib/prisma";

type PaddleEvent = {
  event_id?: string;
  event_type?: string;
  data?: {
    id?: string;
    status?: string;
    action?: string;
    transaction_id?: string;
    currency_code?: string;
    custom_data?: { orderId?: string; expectedTotal?: string; currency?: string };
    details?: { totals?: { grand_total?: string } };
    totals?: { total?: string };
  };
};

export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (usesDummyCredential(secret)) {
    return Response.json({ error: "Paddle webhook is not configured" }, { status: 400 });
  }
  const rawBody = await request.text();
  if (!verifyPaddleSignature(rawBody, request.headers.get("paddle-signature"), secret as string)) {
    return Response.json({ error: "Invalid Paddle signature" }, { status: 400 });
  }

  let claimedEventId: string | null = null;
  let event: PaddleEvent | undefined;
  try {
    event = JSON.parse(rawBody) as PaddleEvent;
    if (!event.event_id || !event.event_type || !event.data?.id) {
      return Response.json({ error: "Invalid Paddle event" }, { status: 400 });
    }

    let orderId = event.data.custom_data?.orderId ?? null;
    if (!orderId && event.data.transaction_id) {
      orderId = (await prisma.order.findUnique({
        where: { providerCheckoutId: event.data.transaction_id },
        select: { id: true },
      }))?.id ?? null;
    }
    claimedEventId = await claimPaymentEvent({
      provider: "PADDLE",
      externalId: event.event_id,
      type: event.event_type,
      orderId,
    });
    if (!claimedEventId) return Response.json({ received: true, duplicate: true });

    if (event.event_type === "transaction.completed") {
      const data = event.data;
      const internalOrderId = data.custom_data?.orderId;
      const order = internalOrderId
        ? await prisma.order.findUnique({ where: { id: internalOrderId } })
        : null;
      if (
        !order ||
        order.paymentMethod !== "PADDLE" ||
        order.providerCheckoutId !== data.id ||
        data.status !== "completed" ||
        data.custom_data?.expectedTotal !== String(order.total) ||
        data.custom_data.currency !== order.currency ||
        data.currency_code !== order.currency ||
        data.details?.totals?.grand_total !== String(order.total)
      ) {
        throw new Error("Paddle transaction total, currency, or order metadata did not match");
      }
      await markOrderPaid(order.id, "PADDLE", data.id);
    } else if (["transaction.canceled", "transaction.past_due"].includes(event.event_type)) {
      const order = await prisma.order.findUnique({
        where: { providerCheckoutId: event.data.id },
        select: { id: true },
      });
      if (order) await reconcilePendingOrder(order.id, { cancel: true, force: true });
    } else if (
      ["adjustment.created", "adjustment.updated"].includes(event.event_type) &&
      event.data.action === "refund" &&
      event.data.status === "approved"
    ) {
      const transactionId = event.data.transaction_id;
      const order = transactionId
        ? await prisma.order.findUnique({
            where: { providerCheckoutId: transactionId },
            include: { refund: true },
          })
        : null;
      if (
        !order?.refund ||
        order.refund.provider !== "PADDLE" ||
        event.data.currency_code !== order.refund.currency ||
        event.data.totals?.total !== String(order.refund.amount)
      ) {
        throw new Error("Paddle refund details did not match");
      }
      await completeRefund(order.id, event.data.id);
    } else {
      await finishPaymentEvent(claimedEventId, "IGNORED");
      return Response.json({ received: true });
    }

    await finishPaymentEvent(claimedEventId, "PROCESSED");
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paddle event processing failed";
    if (claimedEventId) {
      await finishPaymentEvent(claimedEventId, "FAILED", message).catch(() => undefined);
    }
    console.error("Paddle webhook processing failed", { eventId: event?.event_id, message });
    return Response.json(
      { error: claimedEventId ? "Event processing failed" : "Invalid Paddle event" },
      { status: claimedEventId ? 500 : 400 },
    );
  }
}
