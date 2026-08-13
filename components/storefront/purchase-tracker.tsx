"use client";

import { useEffect } from "react";
import type { PurchaseTrackerProps } from "@/types";
import { track } from "@/lib/analytics";

export function PurchaseTracker({ orderId, contentIds, value, currency }: PurchaseTrackerProps) {
  useEffect(() => {
    const key = `purchase-tracked:${orderId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    track("purchase", { order_id: orderId, content_ids: contentIds, value, currency });
  }, [contentIds, currency, orderId, value]);
  return null;
}
