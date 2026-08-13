"use client";

import { useEffect } from "react";
import { incrementProductViewAction } from "@/actions/analytics";
import { track } from "@/lib/analytics";
import { convertFromUsd } from "@/lib/currency";
import { useStore } from "@/components/storefront/store-provider";
import type { ProductViewTrackerProps } from "@/types";

export function ProductViewTracker({ productId, priceUsd, currency }: ProductViewTrackerProps) {
  const { rates } = useStore();

  useEffect(() => {
    void incrementProductViewAction(productId);
    track("view_item", {
      content_ids: [productId],
      value: convertFromUsd(priceUsd, currency, rates) / 100,
      currency,
    });
  }, [currency, priceUsd, productId, rates]);
  return null;
}
