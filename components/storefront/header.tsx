"use client";

import Image from "next/image";
import { Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useStore } from "@/components/storefront/store-provider";
import type { CurrencyCode, Locale, StoreSettingsData } from "@/types";

export function StoreHeader({ locale, settings }: { locale: Locale; settings: StoreSettingsData }) {
  const t = useTranslations("Common");
  const headerT = useTranslations("header");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { currency, setCurrency, cart, setCartOpen, pending } = useStore();
  const oppositeLocale = locale === "en" ? "ar" : "en";
  const localizedPath = pathname.replace(/^\/(en|ar)/, `/${oppositeLocale}`) || `/${oppositeLocale}`;
  const localePath = searchParams.size ? `${localizedPath}?${searchParams.toString()}` : localizedPath;

  return (
    <>
      {settings.announcementEnabled && (settings.announcementEn || settings.announcementAr) && (
        <div className="bg-primary px-4 py-2 text-center text-xs font-semibold tracking-wide text-primary-foreground sm:text-sm">
          {locale === "ar" ? settings.announcementAr : settings.announcementEn}
        </div>
      )}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container-shell flex h-16 items-center gap-3 lg:h-20">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("menu")}>
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="start" className="w-[85%] max-w-sm p-6">
              <SheetHeader>
                <SheetTitle className="text-start text-2xl font-bold">{settings.storeName}</SheetTitle>
              </SheetHeader>
              <nav className="mt-10 flex flex-col gap-1">
                <Link className="rounded-lg px-3 py-3 text-lg font-medium hover:bg-muted" href="/" onClick={() => setMenuOpen(false)}>{t("home")}</Link>
                <Link className="rounded-lg px-3 py-3 text-lg font-medium hover:bg-muted" href="/products" onClick={() => setMenuOpen(false)}>{t("shop")}</Link>
                <Link className="rounded-lg px-3 py-3 text-lg font-medium hover:bg-muted" href="/account" onClick={() => setMenuOpen(false)}>{t("account")}</Link>
              </nav>
              <div className="mt-8 grid grid-cols-2 gap-3 border-t pt-6 sm:hidden">
                <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                  {t("currency")}
                  <select
                    value={currency}
                    disabled={pending}
                    onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
                    className="h-11 rounded-lg border bg-card px-3 text-sm font-bold text-foreground outline-none"
                  >
                    <option>USD</option><option>SAR</option><option>AUD</option>
                  </select>
                </label>
                <div className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                  {t("language")}
                  <a
                    href={localePath}
                    className="grid h-11 place-items-center rounded-lg border bg-card text-sm font-bold text-foreground"
                  >
                    {locale === "en" ? headerT("switchToArabic") : headerT("switchToEnglish")}
                  </a>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="me-auto flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl lg:me-8">
            {settings.logoUrl ? (
              <Image src={settings.logoUrl} alt="" width={32} height={32} className="size-8 rounded-xl object-cover" />
            ) : (
              <span className="grid size-8 place-items-center rounded-xl bg-primary text-sm text-primary-foreground">
                {settings.storeName.charAt(0).toUpperCase()}
              </span>
            )}
            <span>{settings.storeName}</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold lg:flex">
            <Link href="/" className="hover:text-primary">{t("home")}</Link>
            <Link href="/products" className="hover:text-primary">{t("shop")}</Link>
          </nav>

          <form action={`/${locale}/products`} className="ms-auto hidden w-full max-w-xs lg:block">
            <label className="relative block">
              <span className="sr-only">{t("search")}</span>
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                placeholder={t("searchPlaceholder")}
                className="h-10 w-full rounded-full border bg-card ps-10 pe-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
            </label>
          </form>

          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSearchOpen((open) => !open)} aria-label={t("search")}>
            {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
          </Button>

          <select
            value={currency}
            disabled={pending}
            onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
            aria-label={t("currency")}
            className="hidden h-9 rounded-lg border bg-card px-2 text-xs font-bold outline-none sm:block"
          >
            <option>USD</option><option>SAR</option><option>AUD</option>
          </select>

          <a href={localePath} className="hidden min-w-10 rounded-lg px-2 py-2 text-center text-sm font-bold hover:bg-muted sm:block">
            {locale === "en" ? headerT("switchToArabic") : headerT("switchToEnglish")}
          </a>

          <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
            <Link href="/account" aria-label={t("account")}><UserRound className="size-5" /></Link>
          </Button>

          <Button variant="ghost" size="icon" className="relative" onClick={() => setCartOpen(true)} aria-label={t("cart")}>
            <ShoppingBag className="size-5" />
            {cart.itemCount > 0 && (
              <span className="absolute end-0 top-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                {cart.itemCount}
              </span>
            )}
          </Button>
        </div>
        {searchOpen && (
          <form action={`/${locale}/products`} className="container-shell border-t py-3 lg:hidden">
            <label className="relative block">
              <span className="sr-only">{t("search")}</span>
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input name="q" autoFocus placeholder={t("searchPlaceholder")} className="h-11 w-full rounded-xl border bg-card ps-10 pe-4 text-sm outline-none focus:border-primary" />
            </label>
          </form>
        )}
      </header>
    </>
  );
}
