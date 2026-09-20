"use client";

import Image from "next/image";
import { Plus, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsdPrice } from "@/lib/currency";
import { useStore } from "@/components/storefront/store-provider";
import type { ProductCardProps } from "@/types";

export function ProductCard({ product, locale }: ProductCardProps) {
  const t = useTranslations("Products");
  const { currency, rates, addToCart, pending } = useStore();
  const title = locale === "ar" ? product.titleAr : product.titleEn;
  const average = product.reviews?.length
    ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length
    : 0;
  const save = product.compareAtUsd
    ? Math.round(((product.compareAtUsd - product.priceUsd) / product.compareAtUsd) * 100)
    : 0;

  return (
    <article className="group min-w-0">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
        <Link href={`/products/${product.slug}`} className="relative block size-full">
          <Image
            src={product.images[0] ?? "https://picsum.photos/seed/product/800/1000"}
            alt={title}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </Link>
        <div className="absolute start-2 top-2 flex flex-col gap-1.5">
          {!product.inStock ? (
            <Badge variant="secondary">{t("outOfStock")}</Badge>
          ) : save > 0 ? (
            <Badge className="bg-card text-card-foreground shadow-sm">{t("save", { percent: save })}</Badge>
          ) : null}
        </div>
        {product.variants.length ? (
          <Button
            asChild
            size="icon"
            className="absolute bottom-3 end-3 size-10 rounded-full shadow-md transition sm:translate-y-14 sm:group-hover:translate-y-0"
          >
            <Link href={`/products/${product.slug}`} aria-label={`${t("quickAdd")} ${title}`}>
              <Plus className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button
            size="icon"
            className="absolute bottom-3 end-3 size-10 rounded-full shadow-md transition sm:translate-y-14 sm:group-hover:translate-y-0"
            disabled={!product.inStock || pending}
            onClick={() => addToCart(product.id)}
            aria-label={`${t("quickAdd")} ${title}`}
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>
      <div className="pt-3">
        <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Star className={`size-3 ${average > 0 ? "fill-current text-amber-500" : "text-muted-foreground/40"}`} />
          <span>{average.toFixed(1)}</span>
          <span>({product.reviews?.length ?? 0})</span>
        </div>
        <Link href={`/products/${product.slug}`} className="line-clamp-1 text-sm font-semibold hover:text-primary sm:text-base">
          {title}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
          <span className="font-bold">{formatUsdPrice(product.priceUsd, currency, locale, rates)}</span>
          {product.compareAtUsd && (
            <span className="text-xs text-muted-foreground line-through">
              {formatUsdPrice(product.compareAtUsd, currency, locale, rates)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
