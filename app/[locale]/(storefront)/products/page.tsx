import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ProductCard } from "@/components/storefront/product-card";
import { SearchTracker } from "@/components/storefront/search-tracker";
import { Button } from "@/components/ui/button";
import { getSelectedCurrency } from "@/lib/currency-server";
import { getCategories, getProductPage } from "@/lib/data";
import type { Locale, ProductSort } from "@/types";

export default async function ProductsPage({ params, searchParams }: PageProps<"/[locale]/products">) {
  const [{ locale: localeParam }, queryParams] = await Promise.all([params, searchParams]);
  const locale = localeParam as Locale;
  const category = typeof queryParams.category === "string" ? queryParams.category : undefined;
  const query = typeof queryParams.q === "string" ? queryParams.q.trim() : undefined;
  const rawSort = typeof queryParams.sort === "string" ? queryParams.sort : "newest";
  const sort: ProductSort = rawSort === "price-asc" || rawSort === "price-desc" ? rawSort : "newest";
  const requestedPage = Number(typeof queryParams.page === "string" ? queryParams.page : "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 12;
  const [t, common, productPage, categories, currency] = await Promise.all([
    getTranslations({ locale, namespace: "Products" }),
    getTranslations({ locale, namespace: "common" }),
    getProductPage(category, query, sort, page, pageSize),
    getCategories(),
    getSelectedCurrency(),
  ]);
  const { products: visibleProducts, page: currentPage, totalPages } = productPage;
  const pageHref = (nextPage: number) => {
    const parameters = new URLSearchParams();
    if (category) parameters.set("category", category);
    if (query) parameters.set("q", query);
    if (sort !== "newest") parameters.set("sort", sort);
    if (nextPage > 1) parameters.set("page", String(nextPage));
    const suffix = parameters.toString();
    return suffix ? `/products?${suffix}` : "/products";
  };

  return (
    <div className="container-shell py-10 sm:py-14">
      {query && <SearchTracker term={query} />}
      <div className="max-w-2xl"><h1 className="text-3xl font-bold sm:text-4xl">{query ? `“${query}”` : t("title")}</h1><p className="mt-3 text-muted-foreground">{t("subtitle")}</p></div>
      <div className="mt-8 flex flex-col gap-5 border-y py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Link href="/products" className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${!category ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}>{t("all")}</Link>
          {categories.map((entry) => <Link key={entry.id} href={`/products?category=${entry.slug}`} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${category === entry.slug ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}>{locale === "ar" ? entry.nameAr : entry.nameEn}</Link>)}
        </div>
        <form className="flex items-center gap-2" action={`/${locale}/products`}>
          {category && <input type="hidden" name="category" value={category} />}{query && <input type="hidden" name="q" value={query} />}
          <label htmlFor="sort" className="text-sm text-muted-foreground">{t("sort")}</label>
          <select id="sort" name="sort" defaultValue={sort} className="h-10 rounded-lg border bg-card px-3 text-sm font-semibold" onChange={undefined}>
            <option value="newest">{t("newest")}</option><option value="price-asc">{t("priceLow")}</option><option value="price-desc">{t("priceHigh")}</option>
          </select>
          <Button type="submit" variant="outline" size="sm">{t("sort")}</Button>
        </form>
      </div>
      {visibleProducts.length ? (
        <><div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 lg:grid-cols-4">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} locale={locale} currency={currency} />)}</div>{totalPages > 1 && <nav className="mt-12 flex items-center justify-center gap-4" aria-label={common("pageOf", { page: currentPage, pages: totalPages })}>{currentPage > 1 ? <Button asChild variant="outline"><Link href={pageHref(currentPage - 1)}>{common("previous")}</Link></Button> : <Button variant="outline" disabled>{common("previous")}</Button>}<span className="text-sm text-muted-foreground">{common("pageOf", { page: currentPage, pages: totalPages })}</span>{currentPage < totalPages ? <Button asChild variant="outline"><Link href={pageHref(currentPage + 1)}>{common("next")}</Link></Button> : <Button variant="outline" disabled>{common("next")}</Button>}</nav>}</>
      ) : (
        <div className="flex min-h-[24rem] flex-col items-center justify-center text-center"><SearchX className="size-10 text-muted-foreground" /><h2 className="mt-5 text-xl font-bold">{t("noResults")}</h2><Button asChild className="mt-5"><Link href="/products">{t("all")}</Link></Button></div>
      )}
    </div>
  );
}
