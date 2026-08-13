"use client";

import type { AnalyticsEvent, AnalyticsPayload, AnalyticsWindow } from "@/types";

const platformEvents: Record<AnalyticsEvent, { meta: string; tiktok: string }> = {
  view_item: { meta: "ViewContent", tiktok: "ViewContent" },
  add_to_cart: { meta: "AddToCart", tiktok: "AddToCart" },
  begin_checkout: { meta: "InitiateCheckout", tiktok: "InitiateCheckout" },
  purchase: { meta: "Purchase", tiktok: "CompletePayment" },
};

export function track(event: AnalyticsEvent, payload: AnalyticsPayload) {
  if (typeof window === "undefined") return;
  const target = window as AnalyticsWindow;
  target.dataLayer = target.dataLayer ?? [];
  target.dataLayer.push({ event, ...payload });
  target.fbq?.("track", platformEvents[event].meta, payload);
  target.ttq?.track?.(platformEvents[event].tiktok, payload);
}
