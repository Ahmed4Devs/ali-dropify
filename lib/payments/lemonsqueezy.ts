import "server-only";

import { PaymentCreationUncertainError } from "@/lib/payments/errors";
import { markOrderPaid, usesDummyCredential } from "@/lib/payments/shared";
import type { PaymentAdapter } from "@/types";

const requestTimeout = 15_000;
export const lemonSqueezyBaseUrl = "https://api.lemonsqueezy.com/v1";

export function getLemonSqueezyHeaders() {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (usesDummyCredential(key)) throw new Error("Lemon Squeezy is not configured");
  return {
    Authorization: `Bearer ${key}`,
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
  };
}

export const lemonSqueezyAdapter: PaymentAdapter = {
  async createPayment(order) {
    if (order.currency !== "USD") {
      throw new Error("Lemon Squeezy only supports USD in this store");
    }
    const key = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    if (
      usesDummyCredential(key) ||
      usesDummyCredential(storeId) ||
      usesDummyCredential(variantId) ||
      storeId === "000000" ||
      variantId === "000000"
    ) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Lemon Squeezy is not configured");
      }
      const paymentRef = `dev-lemonsqueezy-${order.id}`;
      await markOrderPaid(order.id, "LEMONSQUEEZY", paymentRef);
      return {
        redirectUrl: `${appUrl}/${order.locale}/checkout/success?order=${order.id}`,
        paymentRef,
        paidInDevelopment: true,
      };
    }

    const expiresAt = new Date(Date.now() + 31 * 60_000);
    const successUrl = `${appUrl}/${order.locale}/checkout/success?order=${order.id}`;
    let response: Response;
    try {
      response = await fetch(`${lemonSqueezyBaseUrl}/checkouts`, {
        method: "POST",
        headers: getLemonSqueezyHeaders(),
        body: JSON.stringify({
          data: {
            type: "checkouts",
            attributes: {
              custom_price: order.total,
              product_options: {
                name: `Order ${order.orderNumber}`,
                description: `${order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)`,
                redirect_url: successUrl,
                receipt_button_text: "View order",
                receipt_link_url: successUrl,
                enabled_variants: [Number(variantId)],
              },
              checkout_data: {
                email: order.email,
                custom: {
                  orderId: order.id,
                  expectedTotal: String(order.total),
                  currency: order.currency,
                },
              },
              expires_at: expiresAt.toISOString(),
              preview: true,
              test_mode: process.env.LEMONSQUEEZY_TEST_MODE === "true",
            },
            relationships: {
              store: { data: { type: "stores", id: storeId } },
              variant: { data: { type: "variants", id: variantId } },
            },
          },
        }),
        signal: AbortSignal.timeout(requestTimeout),
      });
    } catch (error) {
      throw new PaymentCreationUncertainError(
        "Lemon Squeezy checkout creation outcome is unknown",
        { cause: error },
      );
    }

    if (!response.ok) {
      const retryIsUnsafe = response.status >= 500 || [408, 409, 425, 429].includes(response.status);
      if (retryIsUnsafe) {
        throw new PaymentCreationUncertainError(
          `Lemon Squeezy checkout creation outcome is unknown (${response.status})`,
        );
      }
      throw new Error(`Lemon Squeezy checkout creation failed (${response.status})`);
    }

    let checkout: {
      data?: {
        id?: string;
        attributes?: {
          url?: string;
          expires_at?: string | null;
          custom_price?: number | null;
          preview?: { currency?: string; total?: number } | null;
        };
      };
    };
    try {
      checkout = await response.json() as typeof checkout;
    } catch (error) {
      throw new PaymentCreationUncertainError(
        "Lemon Squeezy created a checkout but returned an unreadable response",
        { cause: error },
      );
    }
    const remote = checkout.data;
    const attributes = remote?.attributes;
    if (!remote?.id || !attributes?.url) {
      throw new PaymentCreationUncertainError(
        "Lemon Squeezy created a checkout without complete redirect details",
      );
    }
    if (
      attributes.custom_price !== order.total ||
      attributes.preview?.currency !== order.currency ||
      attributes.preview.total !== order.total
    ) {
      throw new PaymentCreationUncertainError(
        "Lemon Squeezy checkout total or currency does not match the order",
      );
    }
    return {
      redirectUrl: attributes.url,
      checkoutId: remote.id,
      expiresAt: attributes.expires_at ? new Date(attributes.expires_at) : expiresAt,
    };
  },
};
