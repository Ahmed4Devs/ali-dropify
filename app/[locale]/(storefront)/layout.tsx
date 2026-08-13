import { StoreShell } from "@/components/storefront/store-shell";
import { findCart } from "@/lib/cart";
import { getSelectedCurrency } from "@/lib/currency-server";
import { getStoreSettings } from "@/lib/data";
import type { Locale } from "@/types";

export const dynamic = "force-dynamic";

export default async function StorefrontLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale: localeParam } = await params;
  const locale = localeParam as Locale;
  const [settings, initialCurrency, initialCart] = await Promise.all([
    getStoreSettings(),
    getSelectedCurrency(),
    findCart(locale),
  ]);

  return (
    <StoreShell
      locale={locale}
      settings={settings}
      initialCurrency={initialCurrency}
      initialCart={initialCart}
    >
      {children}
    </StoreShell>
  );
}
