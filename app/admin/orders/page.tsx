import { z } from "zod";
import { createTranslator } from "next-intl";

import { AdminPageHeader } from "@/components/admin/page-header";
import { OrderManager } from "@/components/admin/order-manager";
import { requireAdmin } from "@/lib/dal";
import { getAdminOrders } from "@/lib/data";
import messages from "@/messages/en.json";

const addressSchema = z.object({
  fullName: z.string().default(""),
  phone: z.string().optional(),
  country: z.string().default(""),
  state: z.string().default(""),
  city: z.string().default(""),
  street: z.string().default(""),
  apartment: z.string().optional(),
  zip: z.string().default(""),
});

export default async function AdminOrdersPage() {
  await requireAdmin();
  const t = createTranslator({ locale: "en", messages, namespace: "admin.orders" });
  const adminOrders = await getAdminOrders();
  const orders = adminOrders.map((order) => {
    const fxRate = Number(order.fxRate);
    const parsedAddress = addressSchema.safeParse(order.shippingAddress);
    const shippingAddress = parsedAddress.success
      ? {
          ...parsedAddress.data,
          fullName: parsedAddress.data.fullName || t("customer"),
        }
      : {
          fullName: order.email,
          country: "",
          state: "",
          city: "",
          street: "",
          zip: "",
        };
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      phone: order.phone,
      status: order.status,
      currency: order.currency,
      total: order.total,
      profit: order.items.reduce(
        (sum, item) => sum +
          Math.round((item.unitPrice - item.unitCostUsd * fxRate) * item.quantity),
        0,
      ),
      paymentMethod: order.paymentMethod,
      paymentRef: order.paymentRef,
      createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
      shippingAddress,
      items: order.items.map((item) => ({
        id: item.id,
        title: item.titleEn,
        image: item.image,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        aliexpressUrl: item.product?.aliexpressUrl ?? null,
      })),
    };
  });

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("subtitle")}
      />
      <OrderManager orders={orders} />
    </>
  );
}
