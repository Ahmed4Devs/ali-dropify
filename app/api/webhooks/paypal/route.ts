import { NextResponse } from "next/server";
import { getPayPalAccessToken, getPayPalBaseUrl } from "@/lib/payments/paypal";
import { markOrderPaid, usesDummyCredential } from "@/lib/payments/shared";
import { prisma } from "@/lib/prisma";

function decimalToMinorUnits(value: string) {
  const [whole = "0", fraction = ""] = value.split(".");
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0").slice(0, 2), 10);
}

async function getPayPalOrder(orderToken: string) {
  if (usesDummyCredential(process.env.PAYPAL_CLIENT_ID)) return null;
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(
    `${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderToken)}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!response.ok) return null;
  return (await response.json()) as {
    id: string;
    status: string;
    purchase_units?: Array<{
      custom_id?: string;
      reference_id?: string;
      amount?: { currency_code?: string; value?: string };
    }>;
  };
}

async function verifyPayPalWebhook(request: Request, event: Record<string, unknown>) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const transmissionId = request.headers.get("paypal-transmission-id");
  const transmissionTime = request.headers.get("paypal-transmission-time");
  const certUrl = request.headers.get("paypal-cert-url");
  const authAlgo = request.headers.get("paypal-auth-algo");
  const transmissionSig = request.headers.get("paypal-transmission-sig");
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) return false;
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  if (!response.ok) return false;
  const result = (await response.json()) as { verification_status?: string };
  return result.verification_status === "SUCCESS";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const expectedOrderId = url.searchParams.get("order");
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "en";
  if (!token || !expectedOrderId) return NextResponse.redirect(new URL(`/${locale}/checkout?payment=failed`, request.url));
  try {
    const accessToken = await getPayPalAccessToken();
    const capture = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(token)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `${expectedOrderId}:capture`,
      },
    });
    const order = await getPayPalOrder(token);
    const linkedOrder = order?.purchase_units?.[0]?.custom_id ?? order?.purchase_units?.[0]?.reference_id;
    const amount = order?.purchase_units?.[0]?.amount;
    const databaseOrder = await prisma.order.findUnique({ where: { id: expectedOrderId } });
    if (
      !capture.ok ||
      !databaseOrder ||
      order?.status !== "COMPLETED" ||
      linkedOrder !== expectedOrderId ||
      amount?.currency_code !== databaseOrder.currency ||
      !amount.value ||
      decimalToMinorUnits(amount.value) !== databaseOrder.total
    ) throw new Error("Capture not confirmed");
    await markOrderPaid(expectedOrderId, "PAYPAL", token);
    return NextResponse.redirect(new URL(`/${locale}/checkout/success?order=${expectedOrderId}`, request.url));
  } catch (error) {
    console.error("PayPal capture failed", error);
    return NextResponse.redirect(new URL(`/${locale}/checkout?payment=failed`, request.url));
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody) as {
      event_type?: string;
      resource?: { id?: string; custom_id?: string; supplementary_data?: { related_ids?: { order_id?: string } } };
    };
    if (!(await verifyPayPalWebhook(request, body as Record<string, unknown>))) {
      return Response.json({ error: "Invalid PayPal signature" }, { status: 400 });
    }
    const paypalOrderId = body.resource?.supplementary_data?.related_ids?.order_id ?? body.resource?.id;
    if (!paypalOrderId || body.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
      return Response.json({ received: true });
    }
    const order = await getPayPalOrder(paypalOrderId);
    const internalOrderId = order?.purchase_units?.[0]?.custom_id ?? order?.purchase_units?.[0]?.reference_id;
    const amount = order?.purchase_units?.[0]?.amount;
    const databaseOrder = internalOrderId
      ? await prisma.order.findUnique({ where: { id: internalOrderId } })
      : null;
    if (
      !order ||
      !databaseOrder ||
      order.status !== "COMPLETED" ||
      !internalOrderId ||
      amount?.currency_code !== databaseOrder.currency ||
      !amount.value ||
      decimalToMinorUnits(amount.value) !== databaseOrder.total
    ) {
      return Response.json({ error: "Payment not confirmed" }, { status: 400 });
    }
    await markOrderPaid(internalOrderId, "PAYPAL", paypalOrderId);
    return Response.json({ received: true });
  } catch (error) {
    console.error("PayPal webhook failed", error);
    return Response.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
