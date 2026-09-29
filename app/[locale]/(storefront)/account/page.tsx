import { AccountDashboard } from "@/components/storefront/account-dashboard";
import { requireUser } from "@/lib/dal";
import { getAddressesForUser, getOrdersForUser } from "@/lib/data";
import type { AccountOrderData, Locale, OrderStatusCode, PaymentMethodCode, SavedAddressData, ShippingAddress } from "@/types";

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const { locale: localeParam } = await params;
  const locale = localeParam as Locale;
  const session = await requireUser(locale);
  const [addresses, orders] = await Promise.all([getAddressesForUser(session.user.id), getOrdersForUser(session.user.id)]);
  const serializableOrders: AccountOrderData[] = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
    total: order.total,
    currency: order.currency,
    status: order.status as OrderStatusCode,
    paymentMethod: order.paymentMethod as PaymentMethodCode | null,
    paymentUrl: order.paymentUrl,
    shippingAddress: order.shippingAddress as ShippingAddress,
    items: order.items.map((item) => ({
      id: item.id,
      titleEn: item.titleEn,
      titleAr: item.titleAr,
      image: item.image,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      carrier: item.carrier,
      trackingNumber: item.trackingNumber,
      trackingUrl: item.trackingUrl,
    })),
  }));
  return <AccountDashboard locale={locale} user={{ id: session.user.id, email: session.user.email, firstName: session.user.firstName ?? null, lastName: session.user.lastName ?? null, phone: session.user.phone ?? null, image: session.user.image ?? null }} addresses={addresses as SavedAddressData[]} orders={serializableOrders} />;
}
