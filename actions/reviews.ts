"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(10).max(2000),
  locale: z.enum(["en", "ar"]),
});

export async function submitReviewAction(input: z.input<typeof reviewSchema>) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "reviewInvalid" as const };
  const session = await requireUser(parsed.data.locale);
  try {
    const purchased = await prisma.order.count({
      where: {
        userId: session.user.id,
        status: { in: ["PAID", "FULFILLED", "DELIVERED"] },
        items: { some: { productId: parsed.data.productId } },
      },
    });
    if (!purchased) return { ok: false as const, error: "reviewPurchaseRequired" as const };
    const existing = await prisma.review.findFirst({
      where: { userId: session.user.id, productId: parsed.data.productId },
      select: { id: true },
    });
    if (existing) return { ok: false as const, error: "reviewAlreadySubmitted" as const };
    const review = await prisma.review.create({
      data: {
        productId: parsed.data.productId,
        userId: session.user.id,
        authorName: session.user.name || session.user.email.split("@")[0],
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        images: [],
        source: "STORE",
        status: "PENDING",
      },
    });
    revalidatePath(`/${parsed.data.locale}/products`);
    return { ok: true as const, data: { id: review.id } };
  } catch {
    return { ok: false as const, error: "reviewSubmitFailed" as const };
  }
}
