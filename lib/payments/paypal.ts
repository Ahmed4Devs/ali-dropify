import "server-only";

import { markOrderPaid, usesDummyCredential } from "@/lib/payments/shared";
import type { PaymentAdapter } from "@/types";

export function getPayPalBaseUrl() {
  return process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
  const secret = process.env.PAYPAL_CLIENT_SECRET ?? "";
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error("Could not authenticate with PayPal");
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

export const paypalAdapter: PaymentAdapter = {
  async createPayment(order) {
    if (order.currency === "SAR") throw new Error("PayPal is not available for SAR");
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    if (usesDummyCredential(clientId)) {
      if (process.env.NODE_ENV === "production") throw new Error("PayPal is not configured");
      const paymentRef = `dev-paypal-${order.id}`;
      await markOrderPaid(order.id, "PAYPAL", paymentRef);
      return {
        redirectUrl: `${appUrl}/${order.locale}/checkout/success?order=${order.id}`,
        paymentRef,
        paidInDevelopment: true,
      };
    }
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `${order.id}:create`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: order.id,
          custom_id: order.id,
          amount: { currency_code: order.currency, value: (order.total / 100).toFixed(2) },
        }],
        application_context: {
          return_url: `${appUrl}/api/webhooks/paypal?order=${order.id}&locale=${order.locale}`,
          cancel_url: `${appUrl}/${order.locale}/checkout?payment=cancelled`,
        },
      }),
    });
    if (!response.ok) throw new Error(`PayPal order creation failed (${response.status})`);
    const body = (await response.json()) as { id?: string; links?: Array<{ rel: string; href: string }> };
    const approval = body.links?.find((link) => link.rel === "approve")?.href;
    if (!approval) throw new Error("PayPal did not return an approval URL");
    return { redirectUrl: approval, paymentRef: body.id };
  },
};
