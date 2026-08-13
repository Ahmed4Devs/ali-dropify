import { CartDrawer } from "@/components/storefront/cart-drawer";
import { StoreFooter } from "@/components/storefront/footer";
import { StoreHeader } from "@/components/storefront/header";
import { StoreProvider } from "@/components/storefront/store-provider";
import type { StoreShellProps } from "@/types";

export function StoreShell({ children, locale, settings, initialCurrency, initialCart }: StoreShellProps) {
  return (
    <StoreProvider
      key={`${initialCart.id}:${initialCart.itemCount}:${initialCurrency}`}
      locale={locale}
      initialCurrency={initialCurrency}
      rates={{ USD: 1, SAR: settings.sarPerUsd, AUD: settings.audPerUsd }}
      initialCart={initialCart}
    >
      <div className="flex min-h-svh flex-col">
        <StoreHeader locale={locale} settings={settings} />
        <main className="flex-1">{children}</main>
        <StoreFooter locale={locale} settings={settings} />
        <CartDrawer locale={locale} settings={settings} />
      </div>
    </StoreProvider>
  );
}
