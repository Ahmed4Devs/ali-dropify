import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  defaultSettings,
  demoCategories,
  demoOrders,
  demoProducts,
  demoReviews,
  demoSearches,
} from "@/lib/defaults";
import type {
  CategoryData,
  ProductData,
  ProductSort,
  SocialLinks,
  StoreSettingsData,
  ValueProposition,
  VariantOptions,
} from "@/types";

const demoFallbackEnabled = process.env.NODE_ENV !== "production";

function rethrowInProduction(error: unknown) {
  if (!demoFallbackEnabled) throw error;
}

function normalizeSettings(
  settings: Awaited<ReturnType<typeof prisma.storeSetting.findUnique>>,
): StoreSettingsData {
  if (!settings) return defaultSettings as StoreSettingsData;
  return {
    ...settings,
    valueProps: settings.valueProps as ValueProposition[] | null,
    socialLinks: settings.socialLinks as SocialLinks | null,
    sarPerUsd: Number(settings.sarPerUsd),
    audPerUsd: Number(settings.audPerUsd),
  };
}

export async function getStoreSettings(): Promise<StoreSettingsData> {
  try {
    return normalizeSettings(
      await prisma.storeSetting.findUnique({ where: { id: "main" } }),
    );
  } catch (error) {
    rethrowInProduction(error);
    return defaultSettings;
  }
}

export async function getCategories(): Promise<CategoryData[]> {
  try {
    const categories = await prisma.category.findMany({ orderBy: { sort: "asc" } });
    return categories;
  } catch (error) {
    rethrowInProduction(error);
    return demoCategories;
  }
}

export async function getProducts(
  category?: string,
  query?: string,
  sort: ProductSort = "newest",
): Promise<ProductData[]> {
  try {
    const where: Prisma.ProductWhereInput = {};
    if (category) where.category = { slug: category };
    if (query) {
      where.OR = [
        { titleEn: { contains: query, mode: "insensitive" } },
        { titleAr: { contains: query, mode: "insensitive" } },
        { tags: { has: query.toLowerCase() } },
      ];
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === "price-asc"
        ? { priceUsd: "asc" }
        : sort === "price-desc"
          ? { priceUsd: "desc" }
          : { createdAt: "desc" };

    const products = await prisma.product.findMany({
      where,
      orderBy,
      include: {
        category: true,
        variants: true,
        reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" } },
      },
    });
    return products.map((product) => ({
      ...product,
      inStock: product.inStock && (!product.trackInventory || product.stockQuantity > product.reservedQuantity),
      variants: product.variants.map((variant) => ({
        ...variant,
        inStock: variant.inStock && (!variant.trackInventory || variant.stockQuantity > variant.reservedQuantity),
        options: variant.options as VariantOptions,
      })),
      reviews: product.reviews,
    }));
  } catch (error) {
    rethrowInProduction(error);
    return filterDemoProducts(category, query, sort);
  }
}

export async function getProductPage(
  category: string | undefined,
  query: string | undefined,
  sort: ProductSort = "newest",
  requestedPage = 1,
  pageSize = 12,
) {
  try {
    const where: Prisma.ProductWhereInput = {};
    if (category) where.category = { slug: category };
    if (query) {
      where.OR = [
        { titleEn: { contains: query, mode: "insensitive" } },
        { titleAr: { contains: query, mode: "insensitive" } },
        { tags: { has: query.toLowerCase() } },
      ];
    }
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === "price-asc"
        ? { priceUsd: "asc" }
        : sort === "price-desc"
          ? { priceUsd: "desc" }
          : { createdAt: "desc" };
    const total = await prisma.product.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const products = await prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: true,
        variants: true,
        reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" } },
      },
    });
    return {
      page,
      total,
      totalPages,
      products: products.map((product) => ({
        ...product,
        inStock: product.inStock && (!product.trackInventory || product.stockQuantity > product.reservedQuantity),
        variants: product.variants.map((variant) => ({
          ...variant,
          inStock: variant.inStock && (!variant.trackInventory || variant.stockQuantity > variant.reservedQuantity),
          options: variant.options as VariantOptions,
        })),
        reviews: product.reviews,
      })) as ProductData[],
    };
  } catch (error) {
    rethrowInProduction(error);
    const products = filterDemoProducts(category, query, sort);
    const total = products.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    return {
      page,
      total,
      totalPages,
      products: products.slice((page - 1) * pageSize, page * pageSize),
    };
  }
}

export async function getProductSitemapEntries() {
  try {
    return await prisma.product.findMany({
      select: { slug: true, updatedAt: true, images: true },
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    rethrowInProduction(error);
    return demoProducts.map((product) => ({
      slug: product.slug,
      updatedAt: new Date(product.updatedAt),
      images: product.images,
    }));
  }
}

function filterDemoProducts(
  category?: string,
  query?: string,
  sort: ProductSort = "newest",
): ProductData[] {
  let result = demoProducts.filter(
    (product) =>
      (!category || product.category?.slug === category) &&
      (!query ||
        `${product.titleEn} ${product.titleAr} ${product.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  if (sort === "price-asc") result = [...result].sort((a, b) => a.priceUsd - b.priceUsd);
  if (sort === "price-desc") result = [...result].sort((a, b) => b.priceUsd - a.priceUsd);
  return result as ProductData[];
}

export async function getFeaturedProducts(): Promise<ProductData[]> {
  const products = await getProducts();
  return [...products]
    .sort((a, b) => b.salesCount - a.salesCount)
    .filter((product) => product.isFeatured || product.salesCount > 0)
    .slice(0, 8);
}

export async function getProductBySlug(slug: string): Promise<ProductData | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        variants: true,
        reviews: {
          where: { status: "APPROVED" },
          include: { user: { select: { id: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (product) {
      return {
        ...product,
        inStock: product.inStock && (!product.trackInventory || product.stockQuantity > product.reservedQuantity),
        variants: product.variants.map((variant) => ({
          ...variant,
          inStock: variant.inStock && (!variant.trackInventory || variant.stockQuantity > variant.reservedQuantity),
          options: variant.options as VariantOptions,
        })),
        reviews: product.reviews,
      };
    }
    return null;
  } catch (error) {
    rethrowInProduction(error);
    // The local demo catalog keeps the UI available before PostgreSQL is started.
  }
  const product = demoProducts.find((entry) => entry.slug === slug);
  if (!product) return null;
  return {
    ...product,
    reviews: demoReviews.filter(
      (review) => review.productId === product.id && review.status === "APPROVED",
    ),
  } as ProductData;
}

export async function getRelatedProducts(categoryId: string | null, productId: string) {
  const products = await getProducts();
  return products
    .filter((product) => product.id !== productId && product.categoryId === categoryId)
    .slice(0, 4);
}

export async function getTestimonials() {
  try {
    const reviews = await prisma.review.findMany({
      where: { status: "APPROVED", images: { isEmpty: false } },
      include: { product: { select: { titleEn: true, titleAr: true } } },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: 4,
    });
    return reviews;
  } catch (error) {
    rethrowInProduction(error);
    // Fall through to seeded-looking local content.
  }
  return demoReviews.filter((review) => review.status === "APPROVED" && review.images.length).slice(0, 4);
}

export async function getOrdersForUser(userId: string) {
  try {
    return await prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    rethrowInProduction(error);
    return [];
  }
}

export async function getAddressesForUser(userId: string) {
  try {
    return await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    });
  } catch (error) {
    rethrowInProduction(error);
    return [];
  }
}

export async function getAdminOrders() {
  return prisma.order.findMany({
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminSnapshot(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  try {
    const [orders, products, searches, reviews, views] = await Promise.all([
      prisma.order.findMany({
        where: { status: { in: ["PAID", "FULFILLED", "DELIVERED"] }, createdAt: { gte: since } },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.findMany({ include: { category: true }, orderBy: { salesCount: "desc" } }),
      prisma.searchLog.findMany({ orderBy: { count: "desc" }, take: 8 }),
      prisma.review.findMany({ include: { product: true }, orderBy: { createdAt: "desc" } }),
      prisma.productView.groupBy({
        by: ["productId"],
        where: { date: { gte: since } },
        _sum: { count: true },
        orderBy: { _sum: { count: "desc" } },
        take: 8,
      }),
    ]);
    return { orders, products, searches, reviews, views };
  } catch (error) {
    rethrowInProduction(error);
    return {
      orders: demoOrders,
      products: demoProducts,
      searches: demoSearches,
      reviews: demoReviews.map((review) => ({
        ...review,
        product: demoProducts.find((product) => product.id === review.productId) ?? null,
      })),
      views: demoProducts.map((product) => ({
        productId: product.id,
        _sum: { count: product.viewsTotal },
      })),
    };
  }
}
