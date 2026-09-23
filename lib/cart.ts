import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/dal";
import { isInventoryAvailable } from "@/lib/inventory";
import type { CartSummary, Locale } from "@/types";

const emptyCart: CartSummary = {
  id: "empty",
  lines: [],
  itemCount: 0,
  subtotalUsd: 0,
};

export async function findCart(locale: Locale = "en") {
  try {
    const session = await getSession();
    const token = (await cookies()).get("guest-cart")?.value;
    const cart = await prisma.cart.findFirst({
      where: session?.user.id ? { userId: session.user.id } : token ? { sessionToken: token } : { id: "missing" },
      include: {
        items: {
          include: { product: true, variant: true },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!cart) return emptyCart;
    const lines = cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      slug: item.product.slug,
      title: locale === "ar" ? item.product.titleAr : item.product.titleEn,
      image: item.product.images[0] ?? null,
      variantId: item.variantId,
      variantTitle: item.variant
        ? locale === "ar"
          ? item.variant.titleAr
          : item.variant.titleEn
        : null,
      unitPriceUsd: item.variant?.priceUsd ?? item.product.priceUsd,
      quantity: item.quantity,
      inStock: isInventoryAvailable(item),
    }));
    return {
      id: cart.id,
      lines,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotalUsd: lines.reduce((sum, line) => sum + line.unitPriceUsd * line.quantity, 0),
    };
  } catch {
    return emptyCart;
  }
}

export async function getWritableCart() {
  const session = await getSession();
  const cookieStore = await cookies();
  if (session?.user.id) {
    // A merge deferred while either cart was in checkout can be retried on the
    // next cart write, after the payment has released its cart lock.
    await mergeGuestCart(session.user.id);
    const existing = await prisma.cart.findFirst({ where: { userId: session.user.id } });
    if (existing) return existing;
    try {
      return await prisma.cart.create({ data: { userId: session.user.id } });
    } catch (error) {
      const duplicate = error instanceof Error && "code" in error && error.code === "P2002";
      if (!duplicate) throw error;
      return prisma.cart.findFirstOrThrow({ where: { userId: session.user.id } });
    }
  }

  let token = cookieStore.get("guest-cart")?.value;
  if (!token) {
    token = crypto.randomUUID();
    cookieStore.set("guest-cart", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return prisma.cart.upsert({
    where: { sessionToken: token },
    update: {},
    create: { sessionToken: token },
  });
}

export async function mergeGuestCart(userId: string) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("guest-cart")?.value;
    if (!token) return;
    const guest = await prisma.cart.findUnique({
      where: { sessionToken: token },
      select: { id: true },
    });
    if (!guest) return;
    const userCart =
      (await prisma.cart.findFirst({ where: { userId } })) ??
      (await prisma.cart.create({ data: { userId } }));

    const merged = await prisma.$transaction(async (transaction) => {
      // Touch both rows to hold their locks until the merge commits. Checkout
      // uses the same rows to claim activeCheckoutKey, so neither cart can
      // change underneath this copy-and-delete operation.
      const guestClaim = await transaction.cart.updateMany({
        where: { id: guest.id, sessionToken: token, activeCheckoutKey: null },
        data: { updatedAt: new Date() },
      });
      if (guestClaim.count !== 1) return false;
      const userClaim = await transaction.cart.updateMany({
        where: { id: userCart.id, userId, activeCheckoutKey: null },
        data: { updatedAt: new Date() },
      });
      if (userClaim.count !== 1) return false;
      const guestItems = await transaction.cartItem.findMany({ where: { cartId: guest.id } });
      for (const item of guestItems) {
        const existing = await transaction.cartItem.findFirst({
          where: {
            cartId: userCart.id,
            productId: item.productId,
            variantId: item.variantId,
          },
        });
        if (existing) {
          await transaction.cartItem.update({
            where: { id: existing.id },
            data: { quantity: Math.min(20, existing.quantity + item.quantity) },
          });
        } else {
          await transaction.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            },
          });
        }
      }
      await transaction.cart.delete({ where: { id: guest.id } });
      return true;
    });
    if (merged) cookieStore.delete("guest-cart");
  } catch {
    // Cart merging is best-effort; authentication should still succeed.
  }
}
