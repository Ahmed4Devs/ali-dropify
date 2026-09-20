import "server-only";

import { prisma } from "@/lib/prisma";
import {
  cancelProviderCheckout,
  inspectProviderCheckout,
  type ProviderOrder,
} from "@/lib/payments/provider-operations";
import { markOrderPaid } from "@/lib/payments/shared";
import { releaseOrderInventory } from "@/lib/inventory";

export type ReconciliationResult =
  | { state: "paid" }
  | { state: "cancelled" }
  | { state: "active" }
  | { state: "unchanged" }
  | { state: "unknown"; message: string };

function toProviderOrder(order: {
  id: string;
  currency: string;
  total: number;
  paymentMethod: "STRIPE" | "MOYASAR" | "PAYPAL" | "PADDLE" | "LEMONSQUEEZY" | null;
  paymentRef: string | null;
  providerCheckoutId: string | null;
  paymentExpiresAt: Date | null;
}) {
  if (!order.paymentMethod) return null;
  return { ...order, paymentMethod: order.paymentMethod } satisfies ProviderOrder;
}

async function cancelLocally(orderId: string, checkoutKey: string) {
  return prisma.$transaction(async (transaction) => {
    const cancelled = await transaction.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: {
        status: "CANCELLED",
        paymentUrl: null,
        paymentExpiresAt: null,
        paymentCreatingAt: null,
        paymentLeaseToken: null,
      },
    });
    if (cancelled.count !== 1) return false;
    await releaseOrderInventory(transaction, orderId);
    await transaction.cart.updateMany({
      where: { activeCheckoutKey: checkoutKey },
      data: { activeCheckoutKey: null },
    });
    return true;
  });
}

export async function reconcilePendingOrder(
  orderId: string,
  options: { cancel?: boolean; force?: boolean } = {},
): Promise<ReconciliationResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      checkoutKey: true,
      status: true,
      currency: true,
      total: true,
      paymentMethod: true,
      paymentRef: true,
      providerCheckoutId: true,
      paymentExpiresAt: true,
      paymentUrl: true,
      paymentCreatingAt: true,
    },
  });
  if (!order || order.status !== "PENDING") return { state: "unchanged" };
  const providerOrder = toProviderOrder(order);
  if (!providerOrder?.providerCheckoutId) {
    if (options.cancel && !order.paymentUrl && !order.paymentCreatingAt) {
      const cancelled = await cancelLocally(order.id, order.checkoutKey);
      return cancelled ? { state: "cancelled" } : { state: "unchanged" };
    }
    return { state: "unknown", message: "The pending order has no provider checkout reference" };
  }
  const expired = Boolean(order.paymentExpiresAt && order.paymentExpiresAt <= new Date());
  if (!options.force && !expired) return { state: "active" };

  const provider = options.cancel
    ? await cancelProviderCheckout(providerOrder)
    : await inspectProviderCheckout(providerOrder);
  if (provider.state === "paid") {
    await markOrderPaid(order.id, providerOrder.paymentMethod, provider.paymentRef);
    return { state: "paid" };
  }
  if (provider.state === "expired") {
    const cancelled = await cancelLocally(order.id, order.checkoutKey);
    return cancelled ? { state: "cancelled" } : { state: "unchanged" };
  }
  if (provider.state === "active") return { state: "active" };
  return { state: "unknown", message: provider.message };
}

export async function reconcileExpiredOrders(limit = 50) {
  const expired = await prisma.order.findMany({
    where: {
      status: "PENDING",
      providerCheckoutId: { not: null },
      paymentExpiresAt: { lte: new Date() },
    },
    orderBy: { paymentExpiresAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
    select: { id: true },
  });

  const results = [];
  for (const order of expired) {
    results.push({ orderId: order.id, ...(await reconcilePendingOrder(order.id, { cancel: true, force: true })) });
  }
  return results;
}
