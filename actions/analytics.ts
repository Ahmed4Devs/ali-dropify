"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";

const idSchema = z.string().min(1).max(100);
const termSchema = z.string().trim().min(1).max(100);

export async function incrementProductViewAction(input: string) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid product" };
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  try {
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

export async function logSearchAction(input: string) {
  const parsed = termSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid search" };
  const term = parsed.data.toLocaleLowerCase();
  try {
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
