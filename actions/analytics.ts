"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

const idSchema = z.string().min(1).max(100);
const termSchema = z.string().trim().min(1).max(100);

export async function incrementProductViewAction(input: string) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid product" };
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  try {
    if (!await consumeRateLimit("analytics", 60, 60)) {
      return { ok: true as const, data: null };
    }
    await prisma.$transaction([
      prisma.productView.upsert({
        where: { productId_date: { productId: parsed.data, date } },
        update: { count: { increment: 1 } },
        create: { productId: parsed.data, date, count: 1 },
      }),
      prisma.product.update({ where: { id: parsed.data }, data: { viewsTotal: { increment: 1 } } }),
    ]);
    return { ok: true as const, data: null };
  } catch {
    return { ok: false as const, error: "View tracking unavailable" };
  }
}

// This action is unauthenticated, so a caller could otherwise insert one row per
// crafted term. Past the cap the log keeps counting terms it already knows and stops
// accepting new ones, which bounds the table without losing the popular-search data
// the admin dashboard reads (lib/data.ts takes the top 8).
const SEARCH_LOG_LIMIT = 5_000;

export async function logSearchAction(input: string) {
  const parsed = termSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid search" };
  const term = parsed.data.toLocaleLowerCase();
  try {
    if (!await consumeRateLimit("analytics", 60, 60)) {
      return { ok: true as const, data: null };
    }
    const seen = await prisma.searchLog.updateMany({
      where: { term },
      data: { count: { increment: 1 }, lastAt: new Date() },
    });
    if (seen.count > 0) return { ok: true as const, data: null };
    if ((await prisma.searchLog.count()) >= SEARCH_LOG_LIMIT) {
      return { ok: true as const, data: null };
    }
    // upsert rather than create: another request may have inserted the same new term.
    await prisma.searchLog.upsert({
      where: { term },
      update: { count: { increment: 1 }, lastAt: new Date() },
      create: { term },
    });
    return { ok: true as const, data: null };
  } catch {
    return { ok: false as const, error: "Search tracking unavailable" };
  }
}
