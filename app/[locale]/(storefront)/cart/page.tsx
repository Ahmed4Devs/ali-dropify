import { CartPage } from "@/components/storefront/cart-page";
import { getStoreSettings } from "@/lib/data";
import type { Locale } from "@/types";

export default async function CartRoute({ params }: PageProps<"/[locale]/cart">) {
  const { locale } = await params;
  return <CartPage locale={locale as Locale} settings={await getStoreSettings()} />;
}
