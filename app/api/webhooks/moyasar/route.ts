import { NextResponse } from "next/server";
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
  if (!paymentId || !orderId || !(await verifyMoyasarPayment(paymentId, orderId))) {
    return NextResponse.redirect(new URL(`/${locale}/checkout?payment=failed`, request.url));
  }
  return NextResponse.redirect(new URL(`/${locale}/checkout/success?order=${orderId}`, request.url));
}

export async function POST(request: Request) {
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
    const paid = await verifyMoyasarInvoice(invoiceId, orderId);
    return Response.json({ received: paid }, { status: paid ? 200 : 400 });
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
}
