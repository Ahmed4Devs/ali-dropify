import "server-only";

import { prisma } from "@/lib/prisma";
import {
  inspectProviderRefund,
  refundProviderPayment,
  type ProviderOrder,
} from "@/lib/payments/provider-operations";

export type RefundResult =
  | { ok: true; state: "succeeded" | "pending" }
  | { ok: false; error: string };

export async function completeRefund(orderId: string, providerRef: string) {
  return prisma.$transaction(async (transaction) => {
    const refund = await transaction.refund.findUnique({ where: { orderId } });
    if (!refund) return false;
    if (refund.status === "SUCCEEDED") return true;
    const order = await transaction.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order || !["PAID", "FULFILLED", "DELIVERED"].includes(order.status)) return false;
    const claimed = await transaction.refund.updateMany({
      where: { orderId, status: { not: "SUCCEEDED" } },
      data: {
        status: "SUCCEEDED",
        providerRef,
        completedAt: new Date(),
        error: null,
      },
    });
    if (claimed.count !== 1) return true;
    const updated = await transaction.order.updateMany({
      where: { id: orderId, status: { in: ["PAID", "FULFILLED", "DELIVERED"] } },
      data: { status: "REFUNDED" },
    });
    if (updated.count !== 1) throw new Error("Refunded order status changed during completion");
    await transaction.adminAuditLog.create({
      data: {
        adminUserId: refund.requestedById,
        action: "ORDER_REFUNDED",
        targetType: "Order",
        targetId: orderId,
        metadata: {
          provider: refund.provider,
          amount: refund.amount,
          currency: refund.currency,
          reason: refund.reason,
          providerRef,
        },
      },
    });
    return true;
  });
}

export async function refundOrder(input: {
  orderId: string;
  reason: string;
  requestedById: string;
}): Promise<RefundResult> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      status: true,
      currency: true,
      total: true,
      paymentMethod: true,
      paymentRef: true,
      providerCheckoutId: true,
      paymentExpiresAt: true,
      refund: { select: { status: true, updatedAt: true } },
    },
  });
  if (!order || !["PAID", "FULFILLED", "DELIVERED"].includes(order.status)) {
    return { ok: false, error: "Only paid orders can be refunded" };
  }
  if (!order.paymentMethod || !order.paymentRef) {
    return { ok: false, error: "The order has no verified payment reference" };
  }
  if (order.refund?.status === "SUCCEEDED") return { ok: true, state: "succeeded" };
  if (
    order.refund?.status === "PENDING" &&
    order.refund.updatedAt > new Date(Date.now() - 10 * 60_000)
  ) {
    return { ok: true, state: "pending" };
  }
  if (order.refund?.status === "NEEDS_REVIEW") {
    return { ok: false, error: "The previous refund outcome is uncertain and needs provider reconciliation" };
  }

  if (order.refund) {
    const restarted = await prisma.refund.updateMany({
      where: {
        orderId: order.id,
        status: order.refund.status,
        updatedAt: order.refund.updatedAt,
      },
      data: {
        status: "PENDING",
        reason: input.reason,
        requestedById: input.requestedById,
        error: null,
      },
    });
    if (restarted.count !== 1) {
      const latest = await prisma.refund.findUnique({
        where: { orderId: order.id },
        select: { status: true },
      });
      if (latest?.status === "SUCCEEDED") return { ok: true, state: "succeeded" };
      if (latest?.status === "NEEDS_REVIEW") {
        return { ok: false, error: "The previous refund outcome needs provider reconciliation" };
      }
      return { ok: true, state: "pending" };
    }
  } else {
    try {
      await prisma.refund.create({
        data: {
          orderId: order.id,
          provider: order.paymentMethod,
          amount: order.total,
          currency: order.currency,
          reason: input.reason,
          requestedById: input.requestedById,
        },
      });
    } catch (error) {
      const duplicate = error instanceof Error && "code" in error && error.code === "P2002";
      if (!duplicate) throw error;
      const latest = await prisma.refund.findUnique({
        where: { orderId: order.id },
        select: { status: true },
      });
      if (latest?.status === "SUCCEEDED") return { ok: true, state: "succeeded" };
      if (latest?.status === "NEEDS_REVIEW") {
        return { ok: false, error: "The previous refund outcome needs provider reconciliation" };
      }
      return { ok: true, state: "pending" };
    }
  }

  const providerOrder = {
    id: order.id,
    currency: order.currency,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentRef: order.paymentRef,
    providerCheckoutId: order.providerCheckoutId,
    paymentExpiresAt: order.paymentExpiresAt,
  } satisfies ProviderOrder;
  const provider = await refundProviderPayment(providerOrder);
  if (provider.state === "succeeded") {
    if (!await completeRefund(order.id, provider.providerRef)) {
      return { ok: false, error: "The provider confirmed the refund, but the order could not be updated" };
    }
    return { ok: true, state: "succeeded" };
  }
  if (provider.state === "pending") {
    const pending = await prisma.refund.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "PENDING", providerRef: provider.providerRef },
    });
    if (pending.count === 1) return { ok: true, state: "pending" };
    const latest = await prisma.refund.findUnique({
      where: { orderId: order.id },
      select: { status: true },
    });
    return latest?.status === "SUCCEEDED"
      ? { ok: true, state: "succeeded" }
      : { ok: true, state: "pending" };
  }

  const failed = await prisma.refund.updateMany({
    where: { orderId: order.id, status: "PENDING" },
    data: {
      status: provider.state === "needs_review" ? "NEEDS_REVIEW" : "FAILED",
      error: provider.message.slice(0, 2_000),
    },
  });
  if (failed.count === 0) {
    const latest = await prisma.refund.findUnique({
      where: { orderId: order.id },
      select: { status: true },
    });
    if (latest?.status === "SUCCEEDED") return { ok: true, state: "succeeded" };
  }
  return { ok: false, error: provider.message };
}

export async function reconcilePendingRefunds(limit = 50) {
  const refunds = await prisma.refund.findMany({
    where: { status: "PENDING", providerRef: { not: null } },
    orderBy: { updatedAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
    select: {
      orderId: true,
      provider: true,
      providerRef: true,
      amount: true,
      currency: true,
      order: { select: { paymentRef: true } },
    },
  });
  const results = [];
  for (const refund of refunds) {
    if (!refund.providerRef) continue;
    const inspected = await inspectProviderRefund({
      orderId: refund.orderId,
      provider: refund.provider,
      providerRef: refund.providerRef,
      amount: refund.amount,
      currency: refund.currency,
      paymentRef: refund.order.paymentRef,
    });
    if (inspected.state === "succeeded") {
      await completeRefund(refund.orderId, inspected.providerRef);
    } else if (inspected.state === "failed") {
      await prisma.refund.updateMany({
        where: { orderId: refund.orderId, status: "PENDING" },
        data: { status: "FAILED", error: inspected.message.slice(0, 2_000) },
      });
    }
    results.push({ orderId: refund.orderId, state: inspected.state });
  }
  return results;
}
