"use client";

import Image from "next/image";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatUsdPrice } from "@/lib/currency";
import { useStore } from "@/components/storefront/store-provider";
import type { Locale, StoreSettingsData } from "@/types";

export function CartDrawer({ locale, settings }: { locale: Locale; settings: StoreSettingsData }) {
  const t = useTranslations("Common");
  const { cart, cartOpen, setCartOpen, currency, rates, updateQuantity, removeItem } = useStore();
  const threshold = settings.freeShippingMinUsd;
  const progress = threshold && threshold > 0 ? Math.min(100, (cart.subtotalUsd / threshold) * 100) : 100;
  const remaining = Math.max(0, (threshold ?? 0) - cart.subtotalUsd);

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent side="end" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="border-b px-5 py-5">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <ShoppingBag className="size-5" /> {t("cart")}
            <span className="text-sm font-normal text-muted-foreground">({cart.itemCount})</span>
          </SheetTitle>
          <SheetDescription className="sr-only">{t("cart")}</SheetDescription>
        </SheetHeader>

        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="mb-5 grid size-16 place-items-center rounded-full bg-muted">
              <ShoppingBag className="size-7 text-muted-foreground" />
            </span>
            <p className="text-lg font-semibold">{t("emptyCart")}</p>
            <Button asChild className="mt-5" onClick={() => setCartOpen(false)}>
              <Link href="/products">{t("continueShopping")}</Link>
            </Button>
          </div>
        ) : (
          <>
            {threshold !== null && (
              <div className="border-b bg-secondary/60 px-5 py-4">
                <p className="mb-2 text-sm font-medium">
                  {remaining > 0
                    ? t("freeShippingAway", {
                        amount: formatUsdPrice(remaining, currency, locale, rates),
                      })
                    : t("freeShippingUnlocked")}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {cart.lines.map((line) => (
                <div key={line.id} className="flex gap-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {line.image && <Image src={line.image} alt={line.title} fill sizes="80px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${line.slug}`}
                      className="line-clamp-1 text-sm font-semibold hover:text-primary"
                      onClick={() => setCartOpen(false)}
                    >
                      {line.title}
                    </Link>
                    {line.variantTitle && <p className="mt-0.5 text-xs text-muted-foreground">{line.variantTitle}</p>}
                    <p className="mt-1 text-sm font-semibold">{formatUsdPrice(line.unitPriceUsd, currency, locale, rates)}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="inline-flex h-8 items-center rounded-lg border bg-background">
                        <button
                          className="grid size-8 place-items-center disabled:opacity-40"
                          disabled={line.quantity <= 1}
                          onClick={() => updateQuantity(line.id, line.quantity - 1)}
                          aria-label={t("decreaseQuantity")}
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-7 text-center text-xs font-medium">{line.quantity}</span>
                        <button
                          className="grid size-8 place-items-center disabled:opacity-40"
                          disabled={line.quantity >= 20}
                          onClick={() => updateQuantity(line.id, line.quantity + 1)}
                          aria-label={t("increaseQuantity")}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <button
                        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                        onClick={() => removeItem(line.id)}
                        aria-label={t("remove")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t bg-card px-5 py-5">
              <div className="mb-4 flex items-center justify-between font-semibold">
                <span>{t("subtotal")}</span>
                <span>{formatUsdPrice(cart.subtotalUsd, currency, locale, rates)}</span>
              </div>
              <Button asChild size="lg" className="w-full" onClick={() => setCartOpen(false)}>
                <Link href="/checkout">{t("checkout")}</Link>
              </Button>
              <Button asChild variant="ghost" className="mt-2 w-full" onClick={() => setCartOpen(false)}>
                <Link href="/cart">{t("viewCart")}</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
