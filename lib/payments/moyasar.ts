import "server-only";

import { PaymentCreationUncertainError } from "@/lib/payments/errors";
import { markOrderPaid, usesDummyCredential } from "@/lib/payments/shared";
import type { PaymentAdapter } from "@/types";

export const moyasarAdapter: PaymentAdapter = {
  async createPayment(order) {
    if (order.currency !== "SAR") throw new Error("Moyasar only supports SAR in this store");
    const key = process.env.MOYASAR_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    if (usesDummyCredential(key)) {
      if (process.env.NODE_ENV === "production") throw new Error("Moyasar is not configured");
      const paymentRef = `dev-moyasar-${order.id}`;
      await markOrderPaid(order.id, "MOYASAR", paymentRef);
      return {
        redirectUrl: `${appUrl}/${order.locale}/checkout/success?order=${order.id}`,
        paymentRef,
        paidInDevelopment: true,
      };
    }
    let response: Response;
    try {
      response = await fetch("https://api.moyasar.com/v1/invoices", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: order.total,
          currency: "SAR",
          description: `Order ${order.orderNumber}`,
          callback_url: `${appUrl}/api/webhooks/moyasar?order=${order.id}&locale=${order.locale}`,
          success_url: `${appUrl}/${order.locale}/checkout/success?order=${order.id}`,
          back_url: `${appUrl}/${order.locale}/checkout?payment=cancelled`,
          metadata: { orderId: order.id },
        }),
      });
    } catch (error) {
      throw new PaymentCreationUncertainError(
        "Moyasar invoice creation outcome is unknown",
        { cause: error },
      );
    }
    if (!response.ok) {
      const retryIsUnsafe = response.status >= 500 ||
        [408, 409, 425, 429].includes(response.status);
      if (retryIsUnsafe) {
        throw new PaymentCreationUncertainError(
          `Moyasar invoice creation outcome is unknown (${response.status})`,
        );
      }
      throw new Error(`Moyasar invoice creation failed (${response.status})`);
    }
    let invoice: { id?: string; url?: string };
    try {
      invoice = (await response.json()) as { id?: string; url?: string };
    } catch (error) {
      throw new PaymentCreationUncertainError(
        "Moyasar created an invoice but returned an unreadable response",
        { cause: error },
      );
    }
    if (!invoice.id || !invoice.url) {
      throw new PaymentCreationUncertainError(
        "Moyasar created an invoice without complete redirect details",
      );
    }
    return { redirectUrl: invoice.url, paymentRef: invoice.id };
  },
};
