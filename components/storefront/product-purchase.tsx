"use client";

import Image from "next/image";
import { Check, Minus, Plus, ShieldCheck, ShoppingBag, Star, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatUsdPrice } from "@/lib/currency";
import { useStore } from "@/components/storefront/store-provider";
import type { LocalizedVariantOptions, ProductPurchaseProps, VariantOptions } from "@/types";

const swatches: Record<string, string> = {
  sand: "#d3bd94",
  black: "#252525",
  white: "#f4f3ef",
  blue: "#53799d",
  red: "#a7473f",
  green: "#58735b",
};

export function ProductPurchase({ product, locale, settings }: ProductPurchaseProps) {
  const t = useTranslations("Product");
  const router = useRouter();
  const { currency, rates, addToCart, pending } = useStore();
  const [activeImage, setActiveImage] = useState(0);
  const productImages = product.images.length
    ? product.images
    : [`https://picsum.photos/seed/${product.slug}/800/1000`];
  const [quantity, setQuantity] = useState(1);
  const optionValue = (options: VariantOptions, key: string, language: "en" | "ar") => {
    const value = (options as LocalizedVariantOptions)[key];
    return typeof value === "string" ? value : value?.[language] ?? "";
  };
  const optionKeys = useMemo(
    () => Array.from(new Set(product.variants.flatMap((variant) => Object.keys(variant.options)))),
    [product.variants],
  );
  const initialOptions = Object.fromEntries(
    optionKeys.map((key) => [key, optionValue(product.variants[0]?.options ?? {}, key, "en")]),
  );
  const [selected, setSelected] = useState<VariantOptions>(initialOptions);
  const variant = product.variants.find((entry) =>
    optionKeys.every((key) => optionValue(entry.options, key, "en") === selected[key]),
  );
  const price = variant?.priceUsd ?? product.priceUsd;
  const available = product.inStock && (variant?.inStock ?? product.variants.length === 0);
  const title = locale === "ar" ? product.titleAr : product.titleEn;
  const save = product.compareAtUsd
    ? Math.round(((product.compareAtUsd - price) / product.compareAtUsd) * 100)
    : 0;
  const reviewCount = product.reviews?.length ?? 0;
  const average = reviewCount
    ? (product.reviews?.reduce((sum, review) => sum + review.rating, 0) ?? 0) / reviewCount
    : 0;

  async function buyNow() {
    const added = await addToCart(product.id, variant?.id, quantity);
    if (added) router.push(`/${locale}/checkout`);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.12fr_.88fr] lg:gap-14">
      <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
        <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col">
          {productImages.map((image, index) => (
            <button
              key={image}
              className={`relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted sm:w-full ${activeImage === index ? "border-primary" : "border-transparent"}`}
              onClick={() => setActiveImage(index)}
              aria-label={`${t("image")} ${index + 1}`}
            >
              <Image src={image} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
        <div className="relative order-1 aspect-[4/5] overflow-hidden rounded-2xl bg-muted sm:order-2">
          <Image
            src={productImages[activeImage] ?? productImages[0]}
            alt={title}
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
        </div>
      </div>

      <div className="lg:sticky lg:top-28 lg:self-start">
        {product.category && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-primary">
            {locale === "ar" ? product.category.nameAr : product.category.nameEn}
          </p>
        )}
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <span className="flex text-amber-500">
            {Array.from({ length: 5 }, (_, index) => <Star key={index} className={`size-4 ${index < Math.round(average) ? "fill-current" : "text-muted-foreground/40"}`} />)}
          </span>
          <span>{average.toFixed(1)} · {t("reviewCount", { count: reviewCount })}</span>
        </a>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-2xl font-black">{formatUsdPrice(price, currency, locale, rates)}</span>
          {product.compareAtUsd && <span className="text-base text-muted-foreground line-through">{formatUsdPrice(product.compareAtUsd, currency, locale, rates)}</span>}
          {save > 0 && <Badge>{t("save", { percent: save })}</Badge>}
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm font-medium">
          <span className={`size-2 rounded-full ${available ? "bg-emerald-500" : "bg-destructive"}`} />
          {available ? t("inStock") : t("outOfStock")}
        </div>

        {optionKeys.map((key) => {
          const values = Array.from(new Set(product.variants.map((entry) => optionValue(entry.options, key, "en")).filter(Boolean)));
          return (
            <fieldset key={key} className="mt-6">
              <legend className="mb-3 text-sm font-bold capitalize">{t.has(`option.${key}`) ? t(`option.${key}`) : key}</legend>
              <div className="flex flex-wrap gap-2">
                {values.map((value) => {
                  const active = selected[key] === value;
                  const isColor = key.toLowerCase() === "color";
                  const localizedVariant = product.variants.find((entry) => optionValue(entry.options, key, "en") === value);
                  const localizedValue = locale === "ar"
                    ? localizedVariant ? optionValue(localizedVariant.options, key, "ar") : value
                    : value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelected((current) => ({ ...current, [key]: value }))}
                      className={`relative inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${active ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary" : "bg-card hover:border-foreground/40"}`}
                      aria-pressed={active}
                    >
                      {isColor && <span className="size-4 rounded-full border" style={{ backgroundColor: swatches[value.toLowerCase()] ?? value }} />}
                      {localizedValue}
                      {active && <Check className="size-3.5" />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div className="mt-7 flex gap-3">
          <div className="inline-flex h-12 items-center rounded-xl border bg-card">
            <button className="grid size-11 place-items-center disabled:opacity-40" disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)} aria-label={t("decreaseQuantity")}><Minus className="size-4" /></button>
            <span className="w-8 text-center font-bold">{quantity}</span>
            <button className="grid size-11 place-items-center disabled:opacity-40" disabled={quantity >= 20} onClick={() => setQuantity((value) => value + 1)} aria-label={t("increaseQuantity")}><Plus className="size-4" /></button>
          </div>
          <Button size="lg" className="flex-1" disabled={!available || pending} onClick={() => addToCart(product.id, variant?.id, quantity)}>
            <ShoppingBag className="size-4" /> {available ? t("addToCart") : t("outOfStock")}
          </Button>
        </div>
        <Button size="lg" variant="outline" className="mt-3 w-full" disabled={!available || pending} onClick={buyNow}>{t("buyNow")}</Button>

        <Separator className="my-7" />
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="flex gap-3"><Truck className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-semibold">{t("trackedDelivery")}</p><p className="mt-0.5 text-muted-foreground">{t("delivery", { estimate: (locale === "ar" ? settings.deliveryEstimateAr : settings.deliveryEstimateEn) ?? t("deliveryDefault") })}</p>{settings.freeShippingMinUsd !== null && <p className="mt-1 text-muted-foreground">{t("freeShippingNote", { amount: formatUsdPrice(settings.freeShippingMinUsd, currency, locale, rates) })}</p>}</div></div>
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-semibold">{t("secureCheckout")}</p><p className="mt-0.5 text-muted-foreground">{t("protectedPayment")}</p></div></div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-3 backdrop-blur lg:hidden">
        <div className="container-shell flex items-center gap-3">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{title}</p><p className="font-black">{formatUsdPrice(price, currency, locale, rates)}</p></div>
          <Button disabled={!available || pending} onClick={() => addToCart(product.id, variant?.id, quantity)}><ShoppingBag className="size-4" /> {t("addToCart")}</Button>
        </div>
      </div>
    </div>
  );
}
