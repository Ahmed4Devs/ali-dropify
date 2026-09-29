import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  availableInventory,
  isInventoryAvailable,
  type InventoryCartLine,
} from "@/lib/inventory-availability";

export { availableInventory, isInventoryAvailable };
export type { InventoryCartLine };

function targetFor(line: InventoryCartLine) {
  return line.variant ?? line.product;
}

export async function reserveCartInventory(
  transaction: Prisma.TransactionClient,
  lines: InventoryCartLine[],
) {
  const reservations = new Map<string, number>();
  for (const line of lines) {
    const target = targetFor(line);
    if (line.product.isPublished === false || !line.product.inStock || !target.inStock) {
      throw new Error("CHECKOUT_STOCK_CHANGED");
    }
    if (!target.trackInventory) {
      reservations.set(line.id, 0);
      continue;
    }
    const minimumStock = target.reservedQuantity + line.quantity;
    const updated = line.variant
      ? await transaction.variant.updateMany({
          where: {
            id: target.id,
            inStock: true,
            reservedQuantity: target.reservedQuantity,
            stockQuantity: { gte: minimumStock },
          },
          data: { reservedQuantity: { increment: line.quantity } },
        })
      : await transaction.product.updateMany({
          where: {
            id: target.id,
            inStock: true,
            reservedQuantity: target.reservedQuantity,
            stockQuantity: { gte: minimumStock },
          },
          data: { reservedQuantity: { increment: line.quantity } },
        });
    if (updated.count !== 1) throw new Error("CHECKOUT_STOCK_CHANGED");
    reservations.set(line.id, line.quantity);
  }
  return reservations;
}

export async function commitOrderInventory(
  transaction: Prisma.TransactionClient,
  orderId: string,
) {
  const claimed = await transaction.order.updateMany({
    where: { id: orderId, inventoryState: "RESERVED" },
    data: { inventoryState: "COMMITTED" },
  });
  if (claimed.count !== 1) return false;
  const items = await transaction.orderItem.findMany({
    where: { orderId, inventoryReserved: { gt: 0 } },
    select: { productId: true, variantId: true, inventoryReserved: true },
  });
  for (const item of items) {
    const quantity = item.inventoryReserved;
    const updated = item.variantId
      ? await transaction.variant.updateMany({
          where: {
            id: item.variantId,
            reservedQuantity: { gte: quantity },
            stockQuantity: { gte: quantity },
          },
          data: {
            reservedQuantity: { decrement: quantity },
            stockQuantity: { decrement: quantity },
          },
        })
      : item.productId
        ? await transaction.product.updateMany({
            where: {
              id: item.productId,
              reservedQuantity: { gte: quantity },
              stockQuantity: { gte: quantity },
            },
            data: {
              reservedQuantity: { decrement: quantity },
              stockQuantity: { decrement: quantity },
            },
          })
        : { count: 0 };
    if (updated.count !== 1) throw new Error("Reserved inventory is inconsistent");
    if (item.variantId) {
      await transaction.variant.updateMany({
        where: { id: item.variantId, stockQuantity: 0 },
        data: { inStock: false },
      });
    } else if (item.productId) {
      await transaction.product.updateMany({
        where: { id: item.productId, stockQuantity: 0 },
        data: { inStock: false },
      });
    }
  }
  return true;
}

export async function releaseOrderInventory(
  transaction: Prisma.TransactionClient,
  orderId: string,
) {
  const claimed = await transaction.order.updateMany({
    where: { id: orderId, inventoryState: "RESERVED" },
    data: { inventoryState: "RELEASED" },
  });
  if (claimed.count !== 1) return false;
  const items = await transaction.orderItem.findMany({
    where: { orderId, inventoryReserved: { gt: 0 } },
    select: { productId: true, variantId: true, inventoryReserved: true },
  });
  for (const item of items) {
    const updated = item.variantId
      ? await transaction.variant.updateMany({
          where: { id: item.variantId, reservedQuantity: { gte: item.inventoryReserved } },
          data: { reservedQuantity: { decrement: item.inventoryReserved } },
        })
      : item.productId
        ? await transaction.product.updateMany({
            where: { id: item.productId, reservedQuantity: { gte: item.inventoryReserved } },
            data: { reservedQuantity: { decrement: item.inventoryReserved } },
          })
        : { count: 0 };
    if (updated.count !== 1) throw new Error("Reserved inventory is inconsistent");
  }
  return true;
}
