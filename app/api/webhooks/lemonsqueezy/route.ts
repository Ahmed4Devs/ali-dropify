import { createHash } from "node:crypto";

import { claimPaymentEvent, finishPaymentEvent } from "@/lib/payments/events";
import { completeRefund } from "@/lib/payments/refunds";
import { markOrderPaid, usesDummyCredential } from "@/lib/payments/shared";
import { verifyLemonSqueezySignature } from "@/lib/payments/webhook-signatures";
import { prisma } from "@/lib/prisma";

type LemonSqueezyEvent = {
  meta?: {
    event_name?: string;
    custom_data?: { orderId?: string; expectedTotal?: string; currency?: string };
  };
  data?: {
    type?: string;
    id?: string;
    attributes?: {
      status?: string;
      currency?: string;
      total?: number;
      refunded?: boolean;
      refunded_amount?: number;
      created_at?: string;
      updated_at?: string;
      refunded_at?: string | null;
      test_mode?: boolean;
    };
  };
};

export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (usesDummyCredential(secret)) {
    return Response.json({ error: "Lemon Squeezy webhook is not configured" }, { status: 400 });
  }
  const rawBody = await request.text();
  if (!verifyLemonSqueezySignature(rawBody, request.headers.get("x-signature"), secret as string)) {
    return Response.json({ error: "Invalid Lemon Squeezy signature" }, { status: 400 });
  }

  let claimedEventId: string | null = null;
  let event: LemonSqueezyEvent | undefined;
  try {
    event = JSON.parse(rawBody) as LemonSqueezyEvent;
    const eventName = event.meta?.event_name;
    const providerOrderId = event.data?.id;
    if (!eventName || !providerOrderId || event.data?.type !== "orders") {
      return Response.json({ error: "Invalid Lemon Squeezy event" }, { status: 400 });
    }
    const internalOrderId = event.meta?.custom_data?.orderId ?? (
      await prisma.order.findUnique({
        where: { paymentRef: providerOrderId },
        select: { id: true },
      })
    )?.id ?? null;
    const bodyHash = createHash("sha256").update(rawBody).digest("hex");
    claimedEventId = await claimPaymentEvent({
      provider: "LEMONSQUEEZY",
      externalId: `${eventName}:${providerOrderId}:${bodyHash}`,
      type: eventName,
      orderId: internalOrderId,
    });
    if (!claimedEventId) return Response.json({ received: true, duplicate: true });

    const attributes = event.data.attributes;
    if (eventName === "order_created") {
      const order = internalOrderId
        ? await prisma.order.findUnique({ where: { id: internalOrderId } })
        : null;
      if (
        !order ||
        order.paymentMethod !== "LEMONSQUEEZY" ||
        attributes?.status !== "paid" ||
        attributes.currency !== order.currency ||
        Number(attributes.total) !== order.total ||
        attributes.test_mode !== (process.env.LEMONSQUEEZY_TEST_MODE === "true") ||
        event.meta?.custom_data?.expectedTotal !== String(order.total) ||
        event.meta.custom_data.currency !== order.currency
      ) {
        throw new Error("Lemon Squeezy order total, currency, mode, or metadata did not match");
      }
      await markOrderPaid(order.id, "LEMONSQUEEZY", providerOrderId);
    } else if (eventName === "order_refunded") {
      const order = await prisma.order.findUnique({
        where: { paymentRef: providerOrderId },
        include: { refund: true },
      });
      if (
        !order?.refund ||
        order.refund.provider !== "LEMONSQUEEZY" ||
        attributes?.currency !== order.refund.currency ||
        !attributes.refunded ||
        Number(attributes.refunded_amount) < order.refund.amount
      ) {
        throw new Error("Lemon Squeezy refund details did not match");
      }
      await completeRefund(order.id, providerOrderId);
    } else {
      await finishPaymentEvent(claimedEventId, "IGNORED");
      return Response.json({ received: true });
    }

    await finishPaymentEvent(claimedEventId, "PROCESSED");
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lemon Squeezy event processing failed";
    if (claimedEventId) {
      await finishPaymentEvent(claimedEventId, "FAILED", message).catch(() => undefined);
    }
    console.error("Lemon Squeezy webhook processing failed", { eventName: event?.meta?.event_name, message });
    return Response.json(
      { error: claimedEventId ? "Event processing failed" : "Invalid Lemon Squeezy event" },
      { status: claimedEventId ? 500 : 400 },
    );
  }
}
