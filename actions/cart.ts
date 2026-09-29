"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findCart, getWritableCart } from "@/lib/cart";
import { availableInventory } from "@/lib/inventory";
import { consumeRateLimit } from "@/lib/rate-limit";

const cartInputSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  quantity: z.number().int().min(1).max(20).default(1),
  locale: z.enum(["en", "ar"]).default("en"),
});

const quantitySchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  locale: z.enum(["en", "ar"]).default("en"),
});

const removeSchema = z.object({
  itemId: z.string().min(1),
  locale: z.enum(["en", "ar"]).default("en"),
});

export async function addToCartAction(input: z.input<typeof cartInputSchema>) {
  const parsed = cartInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "cartInvalidItem" as const };

  try {
    if (!await consumeRateLimit("cart", 120, 60)) {
      return { ok: false as const, error: "rateLimited" as const };
    }
    const product = await prisma.product.findUnique({
      where: { id: parsed.data.productId },
      include: { variants: true },
    });
    if (!product || !product.isPublished || !product.inStock) return { ok: false as const, error: "cartItemOutOfStock" as const };
    if (product.variants.length > 0 && !parsed.data.variantId) {
      return { ok: false as const, error: "cartOptionsRequired" as const };
    }
    const variant = parsed.data.variantId
      ? product.variants.find((entry) => entry.id === parsed.data.variantId)
      : null;
    if (parsed.data.variantId && (!variant || !variant.inStock)) {
      return { ok: false as const, error: "cartVariantOutOfStock" as const };
    }

    const cart = await getWritableCart();
    if (cart.activeCheckoutKey) {
      return { ok: false as const, error: "cartLocked" as const };
    }
    const mutation = await prisma.$transaction(async (transaction) => {
      const unlocked = await transaction.cart.updateMany({
        where: { id: cart.id, activeCheckoutKey: null },
        data: { updatedAt: new Date() },
      });
      if (unlocked.count !== 1) return false;
      const existing = await transaction.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: product.id,
          variantId: variant?.id ?? null,
        },
      });
      const desiredQuantity = Math.min(
        20,
        (existing?.quantity ?? 0) + parsed.data.quantity,
      );
      if (availableInventory({
        id: existing?.id ?? "new-cart-line",
        quantity: desiredQuantity,
        product,
        variant: variant ?? null,
      }) < desiredQuantity) {
        return "out-of-stock" as const;
      }
      if (existing) {
        await transaction.cartItem.update({
          where: { id: existing.id },
          data: { quantity: desiredQuantity },
        });
      } else {
        await transaction.cartItem.create({
          data: {
            cartId: cart.id,
            productId: product.id,
            variantId: variant?.id,
            quantity: parsed.data.quantity,
          },
        });
      }
      return "updated" as const;
    });
    if (mutation === false) {
      return { ok: false as const, error: "cartLocked" as const };
    }
    if (mutation === "out-of-stock") {
      return {
        ok: false as const,
        error: variant ? "cartVariantOutOfStock" as const : "cartItemOutOfStock" as const,
      };
    }
    revalidatePath(`/${parsed.data.locale}/cart`);
    return { ok: true as const, data: await findCart(parsed.data.locale) };
  } catch {
    return { ok: false as const, error: "cartUnavailable" as const };
  }
}

export async function updateCartQuantityAction(input: z.input<typeof quantitySchema>) {
  const parsed = quantitySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "cartInvalidQuantity" as const };
  try {
    if (!await consumeRateLimit("cart", 120, 60)) {
      return { ok: false as const, error: "rateLimited" as const };
    }
    const cart = await getWritableCart();
    if (cart.activeCheckoutKey) {
      return { ok: false as const, error: "cartLocked" as const };
    }
    const cartItem = await prisma.cartItem.findFirst({
      where: { id: parsed.data.itemId, cartId: cart.id },
      include: { product: true, variant: true },
    });
    if (!cartItem) {
      return { ok: false as const, error: "cartItemNotFound" as const };
    }
    if (availableInventory({ ...cartItem, quantity: parsed.data.quantity }) < parsed.data.quantity) {
      return {
        ok: false as const,
        error: cartItem.variant ? "cartVariantOutOfStock" as const : "cartItemOutOfStock" as const,
      };
    }
    const result = await prisma.$transaction(async (transaction) => {
      const unlocked = await transaction.cart.updateMany({
        where: { id: cart.id, activeCheckoutKey: null },
        data: { updatedAt: new Date() },
      });
      if (unlocked.count !== 1) return { locked: true, count: 0 };
      const updated = await transaction.cartItem.updateMany({
        where: { id: parsed.data.itemId, cartId: cart.id },
        data: { quantity: parsed.data.quantity },
      });
      return { locked: false, count: updated.count };
    });
    if (result.locked) return { ok: false as const, error: "cartLocked" as const };
    if (!result.count) return { ok: false as const, error: "cartItemNotFound" as const };
    revalidatePath(`/${parsed.data.locale}/cart`);
    return { ok: true as const, data: await findCart(parsed.data.locale) };
  } catch {
    return { ok: false as const, error: "cartUpdateFailed" as const };
  }
}

export async function removeCartItemAction(input: z.input<typeof removeSchema>) {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "cartInvalidItem" as const };
  try {
    if (!await consumeRateLimit("cart", 120, 60)) {
      return { ok: false as const, error: "rateLimited" as const };
    }
    const cart = await getWritableCart();
    if (cart.activeCheckoutKey) {
      return { ok: false as const, error: "cartLocked" as const };
    }
    const removed = await prisma.$transaction(async (transaction) => {
      const unlocked = await transaction.cart.updateMany({
        where: { id: cart.id, activeCheckoutKey: null },
        data: { updatedAt: new Date() },
      });
      if (unlocked.count !== 1) return false;
      await transaction.cartItem.deleteMany({ where: { id: parsed.data.itemId, cartId: cart.id } });
      return true;
    });
    if (!removed) return { ok: false as const, error: "cartLocked" as const };
    revalidatePath(`/${parsed.data.locale}/cart`);
    return { ok: true as const, data: await findCart(parsed.data.locale) };
  } catch {
    return { ok: false as const, error: "cartRemoveFailed" as const };
  }
}
