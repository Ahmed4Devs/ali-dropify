import Image from "next/image";
import { CheckCircle2, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductPurchase } from "@/components/storefront/product-purchase";
import { ProductViewTracker } from "@/components/storefront/product-view-tracker";
import { ReviewForm } from "@/components/storefront/review-form";
import { getSelectedCurrency } from "@/lib/currency-server";
import { getSession } from "@/lib/dal";
import { getProductBySlug, getRelatedProducts, getStoreSettings } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/types";

export default async function ProductPage({ params }: PageProps<"/[locale]/products/[slug]">) {
  const { locale: localeParam, slug } = await params;
  const locale = localeParam as Locale;
  const [product, settings, currency, session, t, detailT] = await Promise.all([
    getProductBySlug(slug),
    getStoreSettings(),
    getSelectedCurrency(),
    getSession(),
    getTranslations({ locale, namespace: "Product" }),
    getTranslations({ locale, namespace: "product" }),
  ]);
  if (!product) notFound();
  const related = await getRelatedProducts(product.categoryId, product.id);
  let canReview = false;
  if (session) {
    try {
      canReview = Boolean(await prisma.order.count({
        where: { userId: session.user.id, status: { in: ["PAID", "FULFILLED", "DELIVERED"] }, items: { some: { productId: product.id } } },
      }));
    } catch {
      canReview = false;
    }
  }
  const reviews = product.reviews ?? [];
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const description = locale === "ar" ? product.descriptionAr : product.descriptionEn;

  return (
    <div className="container-shell py-8 pb-24 sm:py-12 lg:pb-0">
      <ProductViewTracker productId={product.id} priceUsd={product.priceUsd} currency={currency} />
      <ProductPurchase product={product} locale={locale} currency={currency} settings={settings} />

      <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_.7fr] lg:gap-14">
        <Accordion type="single" collapsible defaultValue="description" className="rounded-xl border bg-card px-5">
          <AccordionItem value="description"><AccordionTrigger className="text-base font-bold">{t("description")}</AccordionTrigger><AccordionContent><p className="pb-4 leading-7 text-muted-foreground">{description}</p></AccordionContent></AccordionItem>
          <AccordionItem value="shipping"><AccordionTrigger className="text-base font-bold">{t("shippingReturns")}</AccordionTrigger><AccordionContent><div className="space-y-3 pb-4 text-sm leading-6 text-muted-foreground"><p>{locale === "ar" ? settings.deliveryEstimateAr : settings.deliveryEstimateEn}</p><p>{detailT("shippingFallback")}</p></div></AccordionContent></AccordionItem>
        </Accordion>
        <div className="rounded-xl bg-secondary p-6"><p className="text-sm font-bold text-primary">{settings.storeName}</p><h2 className="mt-2 text-xl font-bold">{detailT("shippingInfo")}</h2><ul className="mt-5 space-y-3 text-sm">{[t("trackedDelivery"), t("secureCheckout"), t("protectedPayment")].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="size-4 shrink-0 text-primary" />{item}</li>)}</ul></div>
      </section>

      <section id="reviews" className="scroll-mt-28 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
          <div><h2 className="text-2xl font-bold">{t("reviews")}</h2><div className="mt-5 flex items-end gap-3"><span className="text-5xl font-black">{average.toFixed(1)}</span><div className="pb-1"><div className="flex text-amber-500">{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`size-4 ${index < Math.round(average) ? "fill-current" : "text-muted-foreground/40"}`} />)}</div><p className="mt-1 text-xs text-muted-foreground">{t("reviewCount", { count: reviews.length })}</p></div></div><div className="mt-6 space-y-2">{[5, 4, 3, 2, 1].map((rating) => { const count = reviews.filter((review) => review.rating === rating).length; const width = reviews.length ? (count / reviews.length) * 100 : 0; return <div key={rating} className="flex items-center gap-2 text-xs"><span className="w-3">{rating}</span><Star className="size-3 fill-current text-amber-500" /><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${width}%` }} /></div></div>; })}</div></div>
          <div className="space-y-5">
            {reviews.length ? reviews.map((review) => (
              <article key={review.id} className="border-b pb-6 last:border-0"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{review.authorName}</p><div className="mt-1 flex text-amber-500">{Array.from({ length: review.rating }, (_, index) => <Star key={index} className="size-3.5 fill-current" />)}</div></div>{review.source === "STORE" && <Badge variant="secondary"><CheckCircle2 className="size-3" /> {t("verified")}</Badge>}</div><p className="mt-4 text-sm leading-6 text-muted-foreground">{locale === "ar" && review.commentAr ? review.commentAr : review.comment}</p>{review.images.length > 0 && <div className="mt-4 flex gap-2">{review.images.map((image) => <div key={image} className="relative size-16 overflow-hidden rounded-lg bg-muted"><Image src={image} alt="" fill sizes="64px" className="object-cover" /></div>)}</div>}</article>
            )) : <p className="text-muted-foreground">{detailT("reviews.emptyDescription")}</p>}
            {canReview && <ReviewForm locale={locale} productId={product.id} />}
          </div>
        </div>
      </section>

      {related.length > 0 && <section className="border-t pt-14"><h2 className="text-2xl font-bold sm:text-3xl">{t("related")}</h2><div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 lg:grid-cols-4">{related.map((entry) => <ProductCard key={entry.id} product={entry} locale={locale} currency={currency} />)}</div></section>}
    </div>
  );
}
