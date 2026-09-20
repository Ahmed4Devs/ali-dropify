import type { MetadataRoute } from "next";

import { getProductSitemapEntries } from "@/lib/data";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const dynamic = "force-dynamic";

function localizedEntry(
  path: string,
  locale: "en" | "ar",
  lastModified?: Date,
  images?: string[],
): MetadataRoute.Sitemap[number] {
  const localizedPath = `/${locale}${path}`;
  return {
    url: `${baseUrl}${localizedPath}`,
    lastModified,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/products" ? 0.9 : 0.8,
    alternates: {
      languages: {
        en: `${baseUrl}/en${path}`,
        ar: `${baseUrl}/ar${path}`,
      },
    },
    images,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProductSitemapEntries();
  const staticEntries = (["en", "ar"] as const).flatMap((locale) => [
    localizedEntry("", locale),
    localizedEntry("/products", locale),
  ]);
  const productEntries = products.flatMap((product) =>
    (["en", "ar"] as const).map((locale) =>
      localizedEntry(
        `/products/${product.slug}`,
        locale,
        product.updatedAt,
        product.images.filter((image) => image.startsWith("https://")),
      ),
    ),
  );
  return [...staticEntries, ...productEntries];
}
