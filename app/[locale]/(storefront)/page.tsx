import Image from "next/image";
import { ArrowRight, MessageCircle, RefreshCcw, ShieldCheck, Star, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/product-card";
import { getSelectedCurrency } from "@/lib/currency-server";
import { getCategories, getFeaturedProducts, getStoreSettings, getTestimonials } from "@/lib/data";
import type { Locale } from "@/types";

const valueIcons = { Truck, ShieldCheck, RefreshCcw, MessageCircle };

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale: localeParam } = await params;
  const locale = localeParam as Locale;
  const [t, settings, categories, products, testimonials, currency] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getStoreSettings(),
    getCategories(),
    getFeaturedProducts(),
    getTestimonials(),
    getSelectedCurrency(),
  ]);
  const values = settings.valueProps ?? [];

  return (
    <>
      <section className="container-shell py-5 sm:py-8">
        <div className="relative min-h-[34rem] overflow-hidden rounded-2xl bg-foreground sm:min-h-[38rem]">
          {settings.heroImage && (
            <Image
              src={settings.heroImage}
              alt=""
              fill
              sizes="100vw"
              fetchPriority="high"
              className="object-cover opacity-75"
            />
          )}
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative flex min-h-[34rem] max-w-2xl flex-col items-start justify-end p-7 text-white sm:min-h-[38rem] sm:p-12 lg:p-16">
            <p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-white/80">{t("heroEyebrow")}</p>
            <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              {locale === "ar" ? settings.heroTitleAr : settings.heroTitleEn}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/85 sm:text-lg">
              {locale === "ar" ? settings.heroSubtitleAr : settings.heroSubtitleEn}
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-7 rounded-full px-7">
              <Link href="/products">
                {locale === "ar" ? settings.heroCtaAr : settings.heroCtaEn}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container-shell py-12 sm:py-16">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">{t("heroEyebrow")}</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">{t("featuredCategories")}</h2></div>
          <Link href="/products" className="text-sm font-semibold text-primary hover:underline">{t("viewAll")}</Link>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-5">
          {categories.map((category) => (
            <Link key={category.id} href={`/products?category=${category.slug}`} className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-muted sm:aspect-[4/3]">
              {category.image && <Image src={category.image} alt={locale === "ar" ? category.nameAr : category.nameEn} fill sizes="33vw" className="object-cover transition duration-500 group-hover:scale-[1.04]" />}
              <div className="absolute inset-0 bg-black/25" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-6"><h3 className="text-sm font-bold sm:text-xl">{locale === "ar" ? category.nameAr : category.nameEn}</h3></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-shell py-12 sm:py-16">
        <div className="mb-7 flex items-end justify-between gap-4"><h2 className="text-2xl font-bold sm:text-3xl">{t("bestSellers")}</h2><Link href="/products" className="text-sm font-semibold text-primary hover:underline">{t("viewAll")}</Link></div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 lg:grid-cols-4">
          {products.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} locale={locale} currency={currency} />)}
        </div>
      </section>

      <section className="border-y bg-card py-14 sm:py-20">
        <div className="container-shell"><h2 className="text-center text-2xl font-bold sm:text-3xl">{t("whyShop")}</h2><div className="mt-9 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value, index) => {
            const Icon = valueIcons[value.icon as keyof typeof valueIcons] ?? ShieldCheck;
            return <div key={`${value.icon}-${index}`} className="text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary"><Icon className="size-5" /></span><h3 className="mt-4 font-bold">{locale === "ar" ? value.titleAr : value.titleEn}</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{locale === "ar" ? value.textAr : value.textEn}</p></div>;
          })}
        </div></div>
      </section>

      <section className="container-shell py-14 sm:py-20">
        <div className="mb-8 text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">{settings.storeName}</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">{t("testimonials")}</h2></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((review) => (
            <figure key={review.id} className="rounded-xl border bg-card p-5">
              <div className="flex text-amber-500">{Array.from({ length: review.rating }, (_, index) => <Star key={index} className="size-4 fill-current" />)}</div>
              <blockquote className="mt-4 text-sm leading-6">“{locale === "ar" && "commentAr" in review ? review.commentAr : review.comment}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <div className="relative size-10 overflow-hidden rounded-full bg-muted">{review.images[0] && <Image src={review.images[0]} alt="" fill sizes="40px" className="object-cover" />}</div>
                <span className="text-sm font-semibold">{review.authorName}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
