import { NextResponse } from "next/server";
import { claimPaymentEvent, finishPaymentEvent } from "@/lib/payments/events";
import { markOrderPaid, usesDummyCredential } from "@/lib/payments/shared";

async function verifyMoyasarPayment(paymentId: string, expectedOrderId: string) {
  const key = process.env.MOYASAR_SECRET_KEY;
  if (usesDummyCredential(key)) return false;
  const response = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
    cache: "no-store",
  });
  if (!response.ok) return false;
  const payment = (await response.json()) as {
    id: string;
    status: string;
    amount: number;
    currency: string;
    metadata?: { orderId?: string };
  };
  const { prisma } = await import("@/lib/prisma");
  const order = await prisma.order.findUnique({ where: { id: expectedOrderId } });
  if (
    !order ||
    payment.status !== "paid" ||
    payment.metadata?.orderId !== expectedOrderId ||
    payment.amount !== order.total ||
    payment.currency !== order.currency
  ) return false;
  await markOrderPaid(expectedOrderId, "MOYASAR", payment.id);
  return true;
}

async function verifyMoyasarInvoice(invoiceId: string, expectedOrderId: string) {
  const key = process.env.MOYASAR_SECRET_KEY;
  if (usesDummyCredential(key)) return false;
  const response = await fetch(`https://api.moyasar.com/v1/invoices/${encodeURIComponent(invoiceId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
    cache: "no-store",
  });
  if (!response.ok) return false;
  const invoice = (await response.json()) as {
    id: string;
    status: string;
    amount: number;
    currency: string;
    metadata?: { orderId?: string };
    payments?: Array<{ id?: string; status?: string }>;
  };
  const { prisma } = await import("@/lib/prisma");
  const order = await prisma.order.findUnique({ where: { id: expectedOrderId } });
  if (
    !order ||
    invoice.status !== "paid" ||
    invoice.metadata?.orderId !== expectedOrderId ||
    invoice.amount !== order.total ||
    invoice.currency !== order.currency
  ) return false;
  const paymentRef = invoice.payments?.find((payment) => payment.status === "paid")?.id ?? invoice.id;
  await markOrderPaid(expectedOrderId, "MOYASAR", paymentRef);
  return true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("id");
  const orderId = url.searchParams.get("order");
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "en";
  if (!paymentId || !orderId) {
    return NextResponse.redirect(new URL(`/${locale}/checkout?payment=failed`, request.url));
  }
  const eventRecordId = await claimPaymentEvent({
    provider: "MOYASAR",
    externalId: `payment-return:${paymentId}`,
    type: "PAYMENT_RETURN",
    orderId,
  });
  if (eventRecordId) {
    try {
      const paid = await verifyMoyasarPayment(paymentId, orderId);
      await finishPaymentEvent(
        eventRecordId,
        paid ? "PROCESSED" : "FAILED",
        paid ? undefined : "Moyasar payment could not be verified",
      );
      if (!paid) return NextResponse.redirect(new URL(`/${locale}/checkout?payment=failed`, request.url));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Moyasar return processing failed";
      await finishPaymentEvent(eventRecordId, "FAILED", message).catch(() => undefined);
      return NextResponse.redirect(new URL(`/${locale}/checkout?payment=failed`, request.url));
    }
  }
  return NextResponse.redirect(new URL(`/${locale}/checkout/success?order=${orderId}`, request.url));
}

export async function POST(request: Request) {
  let claimedEventId: string | null = null;
  try {
    const body = (await request.json()) as {
      id?: string;
      metadata?: { orderId?: string };
      payments?: Array<{ id?: string }>;
    };
    const url = new URL(request.url);
    const orderId = body.metadata?.orderId ?? url.searchParams.get("order") ?? undefined;
    const invoiceId = body.id;
    if (!invoiceId || !orderId) return Response.json({ error: "Invalid payload" }, { status: 400 });
    claimedEventId = await claimPaymentEvent({
      provider: "MOYASAR",
      externalId: `invoice:${invoiceId}:paid`,
      type: "INVOICE_PAID",
      orderId,
    });
    if (!claimedEventId) return Response.json({ received: true, duplicate: true });
    const paid = await verifyMoyasarInvoice(invoiceId, orderId);
    await finishPaymentEvent(
      claimedEventId,
      paid ? "PROCESSED" : "FAILED",
      paid ? undefined : "Moyasar invoice could not be verified",
    );
    return Response.json({ received: paid }, { status: paid ? 200 : 400 });
  } catch (error) {
    if (claimedEventId) {
      const message = error instanceof Error ? error.message : "Moyasar event processing failed";
      await finishPaymentEvent(claimedEventId, "FAILED", message).catch(() => undefined);
    }
    return Response.json(
      { error: claimedEventId ? "Event processing failed" : "Invalid payload" },
      { status: claimedEventId ? 500 : 400 },
    );
  }
}
