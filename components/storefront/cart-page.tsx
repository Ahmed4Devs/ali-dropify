"use client";

import Image from "next/image";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatUsdPrice } from "@/lib/currency";
import { useStore } from "@/components/storefront/store-provider";
import type { Locale, StoreSettingsData } from "@/types";

export function CartPage({ locale, settings }: { locale: Locale; settings: StoreSettingsData }) {
  const t = useTranslations("Common");
  const { cart, currency, rates, updateQuantity, removeItem } = useStore();
  const threshold = settings.freeShippingMinUsd;
  const remaining = Math.max(0, (threshold ?? 0) - cart.subtotalUsd);
  const progress = threshold && threshold > 0 ? Math.min(100, (cart.subtotalUsd / threshold) * 100) : 100;

  if (!cart.lines.length) {
    return (
      <div className="container-shell flex min-h-[55vh] flex-col items-center justify-center py-20 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-muted"><ShoppingBag className="size-8 text-muted-foreground" /></span>
        <h1 className="mt-6 text-3xl font-bold">{t("emptyCart")}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">{t("emptyCartDescription")}</p>
        <Button asChild size="lg" className="mt-7"><Link href="/products">{t("continueShopping")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="container-shell py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{t("cart")}</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_23rem]">
        <div className="space-y-5">
          {cart.lines.map((line) => (
            <article key={line.id} className="flex gap-4 rounded-xl border bg-card p-3 sm:gap-5 sm:p-4">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-32">
                {line.image && <Image src={line.image} alt={line.title} fill sizes="128px" className="object-cover" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div><Link href={`/products/${line.slug}`} className="font-semibold hover:text-primary">{line.title}</Link>{line.variantTitle && <p className="mt-1 text-xs text-muted-foreground">{line.variantTitle}</p>}</div>
                  <button onClick={() => removeItem(line.id)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={t("remove")}><Trash2 className="size-4" /></button>
                </div>
                <p className="mt-2 font-bold">{formatUsdPrice(line.unitPriceUsd, currency, locale, rates)}</p>
                <div className="mt-auto pt-3">
                  <div className="inline-flex h-9 items-center rounded-lg border">
                    <button aria-label={t("decreaseQuantity")} disabled={line.quantity <= 1} onClick={() => updateQuantity(line.id, line.quantity - 1)} className="grid size-9 place-items-center disabled:opacity-30"><Minus className="size-3.5" /></button>
                    <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                    <button aria-label={t("increaseQuantity")} disabled={line.quantity >= 20} onClick={() => updateQuantity(line.id, line.quantity + 1)} className="grid size-9 place-items-center disabled:opacity-30"><Plus className="size-3.5" /></button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
        <aside className="h-fit rounded-xl border bg-card p-5 lg:sticky lg:top-28">
          {threshold !== null && (
            <div className="mb-6 rounded-xl bg-secondary p-4">
              <p className="text-sm font-semibold">{remaining ? t("freeShippingAway", { amount: formatUsdPrice(remaining, currency, locale, rates) }) : t("freeShippingUnlocked")}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
            </div>
          )}
          <h2 className="text-lg font-bold">{t("orderSummary")}</h2>
          <div className="mt-5 flex justify-between text-sm"><span className="text-muted-foreground">{t("subtotal")}</span><span>{formatUsdPrice(cart.subtotalUsd, currency, locale, rates)}</span></div>
          <p className="mt-3 text-xs text-muted-foreground">{t("shippingAtCheckout")}</p>
          <Separator className="my-5" />
          <div className="flex justify-between font-bold"><span>{t("total")}</span><span>{formatUsdPrice(cart.subtotalUsd, currency, locale, rates)}</span></div>
          <Button asChild size="lg" className="mt-6 w-full"><Link href="/checkout">{t("checkout")} <ArrowRight className="size-4 rtl:rotate-180" /></Link></Button>
        </aside>
      </div>
    </div>
  );
}
