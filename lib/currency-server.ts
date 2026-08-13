import "server-only";

import { cookies } from "next/headers";
import type { CurrencyCode } from "@/types";

export async function getSelectedCurrency(): Promise<CurrencyCode> {
  const value = (await cookies()).get("store-currency")?.value;
  return value === "SAR" || value === "AUD" ? value : "USD";
}
