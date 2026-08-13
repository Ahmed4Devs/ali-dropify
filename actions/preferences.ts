"use server";

import { cookies } from "next/headers";
import { z } from "zod";

const currencySchema = z.enum(["USD", "SAR", "AUD"]);

export async function setCurrencyAction(input: string) {
  const parsed = currencySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Unsupported currency" };
  (await cookies()).set("store-currency", parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true as const, data: parsed.data };
}
