import "server-only";

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { commitOrderInventory } from "@/lib/inventory";
import type { PaymentMethodCode } from "@/types";

export function usesDummyCredential(value: string | undefined) {
  return !value || value.includes("dummy") || value.includes("XXXX");
}

export async function markOrderPaid(
  orderId: string,
  method: PaymentMethodCode,
  paymentRef: string,
) {
  const paid = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.order.updateMany({
      where: { id: orderId, status: "PENDING", paymentMethod: method },
      data: {
        status: "PAID",
        paymentMethod: method,
        paymentRef,
        paymentUrl: null,
        paymentExpiresAt: null,
        paymentCreatingAt: null,
        paymentLeaseToken: null,
      },
    });
    if (updated.count !== 1) return null;
    const order = await transaction.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return null;
    if (order.inventoryState === "RESERVED") {
      await commitOrderInventory(transaction, order.id);
    }
    const claimedCart = await transaction.cart.findUnique({
      where: { activeCheckoutKey: order.checkoutKey },
      select: { id: true },
    });
    if (claimedCart) {
      await transaction.cartItem.deleteMany({ where: { cartId: claimedCart.id } });
      await transaction.cart.update({
        where: { id: claimedCart.id },
        data: { activeCheckoutKey: null },
      });
    }
    for (const item of order.items) {
      if (item.productId) {
        await transaction.product.update({
          where: { id: item.productId },
          data: { salesCount: { increment: item.quantity } },
        });
      }
    }
    return order;
  });

  if (paid) {
    try {
      await sendMail(
        paid.email,
        `Order ${paid.orderNumber} confirmed`,
        `Thanks for your order. We received your payment and will send tracking details when it ships.`,
      );
    } catch (error) {
      console.error(`Order ${paid.orderNumber} was paid but its confirmation email failed`, error);
    }
  }
  return paid;
}
