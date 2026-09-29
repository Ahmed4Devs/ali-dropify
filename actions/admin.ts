"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { parseAliExpressProductUrl } from "@/lib/aliexpress";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { reconcilePendingOrder } from "@/lib/payments/lifecycle";
import { refundOrder } from "@/lib/payments/refunds";
import type { ActionResult } from "@/types";

const idSchema = z.string().trim().min(1).max(191);
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Use lowercase letters, numbers, and single hyphens",
  });

const webUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a valid http or https URL");

const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine((value) => {
    if (value.startsWith("/uploads/")) {
      // Must name a single file directly inside public/uploads. Storing a traversing
      // path here is harmless today, but it is the shape that turned the avatar
      // cleanup into an arbitrary-delete (see lib/avatar.ts) — so reject it at write.
      const filename = value.slice("/uploads/".length);
      return (
        filename.length > 0 &&
        !filename.includes("/") &&
        !filename.includes("\\") &&
        filename !== "." &&
        filename !== ".."
      );
    }
    try {
      const url = new URL(value);
      return url.protocol === "https:" &&
        (url.hostname === "picsum.photos" || url.hostname === "alicdn.com" || url.hostname.endsWith(".alicdn.com"));
    } catch {
      return false;
    }
  }, {
    message: "Use an uploaded image, picsum.photos, or an HTTPS alicdn.com image",
  });

const categorySchema = z
  .object({
    slug: slugSchema,
    nameEn: z.string().trim().min(1).max(120),
    nameAr: z.string().trim().min(1).max(120),
    image: imageUrlSchema.nullable().optional().default(null),
    sort: z.number().int().min(0).max(100_000).optional().default(0),
  })
  .strict();

const updateCategorySchema = categorySchema
  .extend({ id: idSchema })
  .strict();

const deleteSchema = z.object({ id: idSchema }).strict();

const variantOptionValueSchema = z.union([
  z.string().trim().min(1).max(100),
  z.object({
    en: z.string().trim().min(1).max(100),
    ar: z.string().trim().min(1).max(100),
  }).strict(),
]);

const skuSchema = z
  .union([
    z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, {
      message: "SKU may contain letters, numbers, dots, underscores, and hyphens",
    }),
    z.literal("").transform(() => null),
    z.null(),
  ])
  .optional()
  .default(null);

const variantSchema = z
  .object({
    titleEn: z.string().trim().min(1).max(150),
    titleAr: z.string().trim().min(1).max(150),
    options: z
      .record(
        z.string().trim().min(1).max(50),
        variantOptionValueSchema,
      )
      .refine((options) => Object.keys(options).length > 0, {
        message: "Each variant needs at least one option",
      }),
    priceUsd: z.number().int().min(0).nullable().optional().default(null),
    costUsd: z.number().int().min(0).max(1_000_000_000).nullable().optional().default(null),
    sku: skuSchema,
    inStock: z.boolean().optional().default(true),
    trackInventory: z.boolean().optional().default(false),
    stockQuantity: z.number().int().min(0).max(1_000_000_000).optional().default(0),
    aliexpressSkuId: z.string().trim().regex(/^[1-9]\d*$/).max(80).nullable().optional().default(null),
  })
  .strict();

const updateVariantSchema = variantSchema
  .safeExtend({ id: idSchema.optional() })
  .strict();

const productSchema = z
  .object({
    slug: slugSchema,
    titleEn: z.string().trim().min(1).max(200),
    titleAr: z.string().trim().min(1).max(200),
    descriptionEn: z.string().trim().min(1).max(100_000),
    descriptionAr: z.string().trim().min(1).max(100_000),
    priceUsd: z.number().int().min(0).max(1_000_000_000),
    compareAtUsd: z
      .number()
      .int()
      .min(0)
      .max(1_000_000_000)
      .nullable()
      .optional()
      .default(null),
    costUsd: z.number().int().min(0).max(1_000_000_000).optional().default(0),
    sku: skuSchema,
    images: z
      .array(imageUrlSchema)
      .min(1, "Add at least one product image")
      .max(20)
      .optional()
      .default([])
      .transform((images) => [...new Set(images)]),
    tags: z
      .array(z.string().trim().min(1).max(50))
      .max(30)
      .optional()
      .default([])
      .transform((tags) => [...new Set(tags)]),
    inStock: z.boolean().optional().default(true),
    trackInventory: z.boolean().optional().default(false),
    stockQuantity: z.number().int().min(0).max(1_000_000_000).optional().default(0),
    isPublished: z.boolean().optional().default(false),
    isFeatured: z.boolean().optional().default(false),
    aliexpressUrl: webUrlSchema.nullable().optional().default(null),
    categoryId: idSchema.nullable().optional().default(null),
    variants: z.array(variantSchema).max(500).optional().default([]),
  })
  .strict()
  .superRefine((product, context) => {
    const combinations = new Set<string>();
    const skus = new Set<string>();
    const supplierSkuIds = new Set<string>();

    if (product.variants.length > 0 && product.trackInventory) {
      context.addIssue({
        code: "custom",
        message: "Track inventory on each variant when variants are present",
        path: ["trackInventory"],
      });
    }

    if (product.aliexpressUrl && !parseAliExpressProductUrl(product.aliexpressUrl)) {
      context.addIssue({
        code: "custom",
        message: "Use an HTTPS AliExpress item URL",
        path: ["aliexpressUrl"],
      });
    }

    if (!product.aliexpressUrl && product.variants.some((variant) => variant.aliexpressSkuId)) {
      context.addIssue({
        code: "custom",
        message: "Add the AliExpress item URL before mapping supplier variants",
        path: ["aliexpressUrl"],
      });
    }

    product.variants.forEach((variant, index) => {
      const combination = JSON.stringify(
        Object.entries(variant.options).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );

      if (combinations.has(combination)) {
        context.addIssue({
          code: "custom",
          message: "Variant option combinations must be unique",
          path: ["variants", index, "options"],
        });
      }
      combinations.add(combination);
      if (variant.sku) {
        const normalizedSku = variant.sku.toUpperCase();
        if (skus.has(normalizedSku)) {
          context.addIssue({
            code: "custom",
            message: "Variant SKUs must be unique",
            path: ["variants", index, "sku"],
          });
        }
        skus.add(normalizedSku);
      }
      if (variant.aliexpressSkuId) {
        if (supplierSkuIds.has(variant.aliexpressSkuId)) {
          context.addIssue({
            code: "custom",
            message: "AliExpress SKU IDs must be unique within a product",
            path: ["variants", index, "aliexpressSkuId"],
          });
        }
        supplierSkuIds.add(variant.aliexpressSkuId);
      }
    });
  });

const updateProductSchema = productSchema
  .safeExtend({
    id: idSchema,
    variants: z.array(updateVariantSchema).max(500).optional().default([]),
  })
  .strict();

const orderStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "FULFILLED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

const updateOrderStatusSchema = z
  .object({
    orderId: idSchema,
    status: orderStatusSchema,
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

const fulfillmentText = (limit: number) =>
  z.string().trim().max(limit).transform((value) => value || null);

const updateFulfillmentSchema = z.object({
  orderItemId: idSchema,
  supplierOrderRef: fulfillmentText(120),
  carrier: fulfillmentText(120),
  trackingNumber: fulfillmentText(120),
  trackingUrl: z.string().trim().max(2_048).refine((value) => {
    if (!value) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Tracking URL must use HTTPS").transform((value) => value || null),
}).strict().superRefine((input, context) => {
  if (input.trackingNumber && !input.carrier) {
    context.addIssue({ code: "custom", path: ["carrier"], message: "Carrier is required with a tracking number" });
  }
  if (input.trackingUrl && !input.trackingNumber) {
    context.addIssue({ code: "custom", path: ["trackingNumber"], message: "Tracking number is required with a tracking URL" });
  }
});

const moderateReviewSchema = z.object({ reviewId: idSchema }).strict();

const updateReviewStatusSchema = moderateReviewSchema
  .extend({ status: z.enum(["APPROVED", "HIDDEN"]) })
  .strict();

const importReviewsSchema = z
  .object({
    productId: idSchema,
    data: z.string().trim().min(1).max(1_000_000),
    format: z.enum(["json", "csv"]),
  })
  .strict();

const importImageUrlsSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") return [];
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return value;

    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return value;
      }
    }

    return trimmed
      .split(/[|;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  },
  z.array(imageUrlSchema).max(10),
);

const importedReviewSchema = z.object({
  author: z.string().trim().min(1).max(120),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(20_000),
  imageUrls: importImageUrlsSchema.optional().default([]),
});

const importedReviewsSchema = z.array(importedReviewSchema).min(1).max(500);

const valuePropositionSchema = z
  .object({
    icon: z.string().trim().min(1).max(100),
    titleEn: z.string().trim().min(1).max(150),
    titleAr: z.string().trim().min(1).max(150),
    textEn: z.string().trim().min(1).max(500),
    textAr: z.string().trim().min(1).max(500),
  })
  .strict();

const socialUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine(
    (value) =>
      value === "" || value === "#" || webUrlSchema.safeParse(value).success,
    "Enter a valid social URL",
  );

const socialLinksSchema = z
  .object({
    facebook: socialUrlSchema.optional(),
    instagram: socialUrlSchema.optional(),
    tiktok: socialUrlSchema.optional(),
    x: socialUrlSchema.optional(),
  })
  .strict();

const storeSettingsSchema = z
  .object({
    storeName: z.string().trim().min(1).max(120).optional(),
    logoUrl: imageUrlSchema.nullable().optional(),
    announcementEn: z.string().trim().max(500).nullable().optional(),
    announcementAr: z.string().trim().max(500).nullable().optional(),
    announcementEnabled: z.boolean().optional(),
    heroTitleEn: z.string().trim().max(300).nullable().optional(),
    heroTitleAr: z.string().trim().max(300).nullable().optional(),
    heroSubtitleEn: z.string().trim().max(1_000).nullable().optional(),
    heroSubtitleAr: z.string().trim().max(1_000).nullable().optional(),
    heroImage: imageUrlSchema.nullable().optional(),
    heroCtaEn: z.string().trim().max(100).nullable().optional(),
    heroCtaAr: z.string().trim().max(100).nullable().optional(),
    valueProps: z.array(valuePropositionSchema).max(12).nullable().optional(),
    shippingFlatUsd: z
      .number()
      .int()
      .min(0)
      .max(100_000_000)
      .optional(),
    freeShippingMinUsd: z
      .number()
      .int()
      .min(0)
      .max(1_000_000_000)
      .nullable()
      .optional(),
    deliveryEstimateEn: z.string().trim().max(500).nullable().optional(),
    deliveryEstimateAr: z.string().trim().max(500).nullable().optional(),
    sarPerUsd: z.number().positive().max(1_000).optional(),
    audPerUsd: z.number().positive().max(1_000).optional(),
    supportEmail: z
      .union([z.email(), z.literal("")])
      .nullable()
      .optional(),
    supportWhatsapp: z.string().trim().max(100).nullable().optional(),
    socialLinks: socialLinksSchema.nullable().optional(),
  })
  .strict()
  .refine((settings) => Object.keys(settings).length > 0, {
    message: "Provide at least one setting to update",
  });

const uploadFileSchema = z
  .instanceof(File)
  .refine((file) => file.size > 0, "Empty files cannot be uploaded")
  .refine((file) => file.size <= 5 * 1_024 * 1_024, {
    message: "Each image must be 5 MB or smaller",
  })
  .refine(
    (file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    "Only JPEG, PNG, and WebP images are supported",
  );

const uploadSchema = z.object({
  files: z
    .array(uploadFileSchema)
    .min(1)
    .max(20)
    .refine(
      (files) => files.reduce((total, file) => total + file.size, 0) <= 20 * 1_024 * 1_024,
      "The combined upload must be 20 MB or smaller",
    ),
});

const formDataSchema = z.instanceof(FormData);

const allowedOrderTransitions = {
  PENDING: ["CANCELLED"],
  PAID: ["FULFILLED", "REFUNDED"],
  FULFILLED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
} satisfies Record<z.output<typeof orderStatusSchema>, readonly z.output<typeof orderStatusSchema>[]>;

function validationError(
  error: z.ZodError,
  fallback: string,
): { ok: false; error: string } {
  return {
    ok: false,
    error: error.issues[0]?.message ?? fallback,
  };
}

function productValidationError(error: z.ZodError) {
  const field = error.issues[0]?.path.join(".") ?? "";
  return {
    ok: false as const,
    error: field.includes("aliexpressSkuId")
      ? "adminInvalidSupplierVariant"
      : field.includes("aliexpressUrl")
        ? "adminInvalidAliExpressUrl"
        : "adminInvalidProduct",
  };
}

function mutationError(
  error: unknown,
  fallback: string,
): { ok: false; error: string } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.map(String)
        : [String(error.meta?.target ?? "")];
      if (target.some((field) => field.toLowerCase().includes("sku"))) {
        return { ok: false, error: "adminSkuInUse" };
      }
      return { ok: false, error: "adminSlugInUse" };
    }
    if (error.code === "P2003") {
      return { ok: false, error: "adminRelatedRecordMissing" };
    }
    if (error.code === "P2025") {
      return { ok: false, error: "adminRecordNotFound" };
    }
  }

  return { ok: false, error: fallback };
}

function revalidateCatalog() {
  revalidatePath("/admin", "layout");
  revalidatePath("/en", "layout");
  revalidatePath("/ar", "layout");
}

function revalidateAdminAndAccounts() {
  revalidatePath("/admin", "layout");
  revalidatePath("/en/account");
  revalidatePath("/ar/account");
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field");

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseCsvReviews(content: string): ActionResult<unknown[]> {
  try {
    const rows = parseCsvRows(content);
    const header = rows[0]?.map((column) =>
      column.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""),
    );

    if (!header) return { ok: false, error: "CSV must include a header row" };

    const authorIndex = header.findIndex((column) =>
      ["author", "authorname"].includes(column),
    );
    const ratingIndex = header.indexOf("rating");
    const commentIndex = header.indexOf("comment");
    const imagesIndex = header.findIndex((column) =>
      ["imageurls", "images"].includes(column),
    );

    if (authorIndex < 0 || ratingIndex < 0 || commentIndex < 0) {
      return {
        ok: false,
        error: "CSV headers must include author, rating, and comment",
      };
    }

    return {
      ok: true,
      data: rows.slice(1).map((columns) => ({
        author: columns[authorIndex] ?? "",
        rating: columns[ratingIndex] ?? "",
        comment: columns[commentIndex] ?? "",
        imageUrls: imagesIndex >= 0 ? (columns[imagesIndex] ?? "") : "",
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not parse CSV",
    };
  }
}

function parseImportedReviews(
  content: string,
  format: z.output<typeof importReviewsSchema>["format"],
): ActionResult<z.output<typeof importedReviewsSchema>> {
  let rawRows: unknown;
  if (format === "json") {
    try {
      rawRows = JSON.parse(content) as unknown;
    } catch {
      return { ok: false, error: "Enter a valid JSON array" };
    }
  } else {
    const csvRows = parseCsvReviews(content);
    if (!csvRows.ok) return csvRows;
    rawRows = csvRows.data;
  }

  const parsed = importedReviewsSchema.safeParse(rawRows);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const row = typeof issue?.path[0] === "number" ? issue.path[0] + 1 : null;
    return {
      ok: false,
      error: `${row ? `Review ${row}: ` : ""}${issue?.message ?? "Invalid review data"}`,
    };
  }

  return { ok: true, data: parsed.data };
}

function hasValidImageSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (mimeType === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

export async function createCategoryAction(
  input: z.input<typeof categorySchema>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "adminInvalidCategory" };

  try {
    const category = await prisma.category.create({
      data: parsed.data,
      select: { id: true, slug: true },
    });
    revalidateCatalog();
    return { ok: true, data: category };
  } catch (error) {
    return mutationError(error, "adminCategoryCreateFailed");
  }
}

export async function updateCategoryAction(
  input: z.input<typeof updateCategorySchema>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();
  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "adminInvalidCategory" };

  const { id, ...data } = parsed.data;
  try {
    const category = await prisma.category.update({
      where: { id },
      data,
      select: { id: true, slug: true },
    });
    revalidateCatalog();
    return { ok: true, data: category };
  } catch (error) {
    return mutationError(error, "adminCategoryUpdateFailed");
  }
}

export async function deleteCategoryAction(
  input: z.input<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "adminInvalidCategory" };

  try {
    const category = await prisma.category.delete({
      where: { id: parsed.data.id },
      select: { id: true },
    });
    revalidateCatalog();
    return { ok: true, data: category };
  } catch (error) {
    return mutationError(error, "adminCategoryDeleteFailed");
  }
}

export async function createProductAction(
  input: z.input<typeof productSchema>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return productValidationError(parsed.error);

  const { variants, ...data } = parsed.data;
  if (data.isPublished && data.aliexpressUrl && variants.some((variant) => !variant.aliexpressSkuId)) {
    return { ok: false, error: "adminInvalidSupplierVariant" };
  }
  try {
    const source = data.aliexpressUrl ? parseAliExpressProductUrl(data.aliexpressUrl) : null;
    const normalizedVariants = variants.map((variant) => ({
      ...variant,
      sku: variant.sku?.toUpperCase() ?? null,
      inStock: variant.trackInventory ? variant.stockQuantity > 0 : variant.inStock,
    }));
    const product = await prisma.product.create({
      data: {
        ...data,
        aliexpressUrl: source?.url ?? null,
        aliexpressProductId: source?.productId ?? null,
        sku: data.sku?.toUpperCase() ?? null,
        inStock: data.trackInventory ? data.stockQuantity > 0 : data.inStock,
        variants: { create: normalizedVariants },
      },
      select: { id: true, slug: true },
    });
    revalidateCatalog();
    return { ok: true, data: product };
  } catch (error) {
    return mutationError(error, "adminProductCreateFailed");
  }
}

export async function updateProductAction(
  input: z.input<typeof updateProductSchema>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return productValidationError(parsed.error);

  const { id, variants, ...data } = parsed.data;
  try {
    const source = data.aliexpressUrl ? parseAliExpressProductUrl(data.aliexpressUrl) : null;
    const result = await prisma.$transaction(async (transaction) => {
      const existingProduct = await transaction.product.findUnique({
        where: { id },
        select: { reservedQuantity: true, isPublished: true, aliexpressUrl: true },
      });
      if (!existingProduct) return { ok: false as const, error: "adminRecordNotFound" };
      if (data.stockQuantity < existingProduct.reservedQuantity) {
        return { ok: false as const, error: "adminStockBelowReserved" };
      }
      const existingVariants = await transaction.variant.findMany({
        where: { productId: id },
        select: { id: true, reservedQuantity: true, aliexpressSkuId: true },
      });
      const sourceChanged = !existingProduct.isPublished ||
        parseAliExpressProductUrl(existingProduct.aliexpressUrl ?? "")?.url !== source?.url;
      if (data.isPublished && data.aliexpressUrl && (
        (sourceChanged && variants.some((variant) => !variant.aliexpressSkuId)) ||
        variants.some((variant) => !variant.id && !variant.aliexpressSkuId)
      )) {
        return { ok: false as const, error: "adminInvalidSupplierVariant" };
      }
      const existingVariantIds = new Set(existingVariants.map((variant) => variant.id));
      const submittedVariantIds = variants.flatMap((variant) =>
        variant.id ? [variant.id] : [],
      );

      if (new Set(submittedVariantIds).size !== submittedVariantIds.length) {
        return { ok: false as const, error: "adminVariantIdsDuplicate" };
      }
      if (submittedVariantIds.some((variantId) => !existingVariantIds.has(variantId))) {
        return { ok: false as const, error: "adminVariantForeign" };
      }

      const submittedVariantIdSet = new Set(submittedVariantIds);
      const removedVariantIds = existingVariants
        .map((variant) => variant.id)
        .filter((variantId) => !submittedVariantIdSet.has(variantId));

      if (existingVariants.some((variant) =>
        removedVariantIds.includes(variant.id) && variant.reservedQuantity > 0
      )) {
        return { ok: false as const, error: "adminVariantReserved" };
      }

      const reservedByVariant = new Map(
        existingVariants.map((variant) => [variant.id, variant.reservedQuantity]),
      );
      if (variants.some((variant) =>
        variant.id &&
        variant.stockQuantity < (reservedByVariant.get(variant.id) ?? 0)
      )) {
        return { ok: false as const, error: "adminStockBelowReserved" };
      }

      const product = await transaction.product.update({
        where: { id },
        data: {
          ...data,
          aliexpressUrl: source?.url ?? null,
          aliexpressProductId: source?.productId ?? null,
          sku: data.sku?.toUpperCase() ?? null,
          inStock: data.trackInventory ? data.stockQuantity > 0 : data.inStock,
        },
        select: { id: true, slug: true },
      });

      if (removedVariantIds.length) {
        await transaction.cartItem.deleteMany({
          where: { productId: id, variantId: { in: removedVariantIds } },
        });
        await transaction.variant.deleteMany({
          where: { productId: id, id: { in: removedVariantIds } },
        });
      }

      if (variants.length) {
        await transaction.cartItem.deleteMany({
          where: { productId: id, variantId: null },
        });
      }

      if (submittedVariantIds.length) {
        // Clear current values first so valid SKU swaps do not trip the unique
        // index halfway through the transaction.
        await transaction.variant.updateMany({
          where: { productId: id, id: { in: submittedVariantIds } },
          data: { sku: null },
        });
      }

      for (const variant of variants) {
        const { id: variantId, ...variantData } = variant;
        const normalizedVariant = {
          ...variantData,
          sku: variantData.sku?.toUpperCase() ?? null,
          inStock: variantData.trackInventory
            ? variantData.stockQuantity > 0
            : variantData.inStock,
        };
        if (variantId) {
          await transaction.variant.update({
            where: { id: variantId },
            data: normalizedVariant,
          });
        } else {
          await transaction.variant.create({
            data: { ...normalizedVariant, productId: id },
          });
        }
      }

      return { ok: true as const, data: product };
    });
    if (!result.ok) return result;
    revalidateCatalog();
    return result;
  } catch (error) {
    return mutationError(error, "adminProductUpdateFailed");
  }
}

export async function deleteProductAction(
  input: z.input<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "adminInvalidProduct" };

  try {
    const product = await prisma.product.delete({
      where: { id: parsed.data.id },
      select: { id: true },
    });
    revalidateCatalog();
    return { ok: true, data: product };
  } catch (error) {
    return mutationError(error, "adminProductDeleteFailed");
  }
}

export async function uploadAdminImagesAction(
  formData: FormData,
): Promise<ActionResult<{ urls: string[] }>> {
  await requireAdmin();
  const parsedFormData = formDataSchema.safeParse(formData);
  if (!parsedFormData.success) {
    return { ok: false, error: "adminInvalidUpload" };
  }

  const parsed = uploadSchema.safeParse({
    files: parsedFormData.data.getAll("files"),
  });
  if (!parsed.success) return { ok: false, error: "adminInvalidUpload" };

  const files = await Promise.all(
    parsed.data.files.map(async (file) => ({
      file,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );
  if (files.some(({ file, bytes }) => !hasValidImageSignature(bytes, file.type))) {
    return { ok: false, error: "adminInvalidImage" };
  }

  try {
    const uploadDirectory = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDirectory, { recursive: true });

    const urls = await Promise.all(
      files.map(async ({ file, bytes }) => {
        const extension =
          file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
        const filename = `${randomUUID()}.${extension}`;
        await writeFile(join(uploadDirectory, filename), bytes, { flag: "wx" });
        return `/uploads/${filename}`;
      }),
    );

    return { ok: true, data: { urls } };
  } catch (error) {
    return mutationError(error, "adminUploadFailed");
  }
}

export async function updateOrderStatusAction(
  input: z.input<typeof updateOrderStatusSchema>,
): Promise<ActionResult<{ id: string; status: z.output<typeof orderStatusSchema> }>> {
  const admin = await requireAdmin();
  const parsed = updateOrderStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error, "Invalid order status");

  try {
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        checkoutKey: true,
        paymentUrl: true,
        paymentCreatingAt: true,
        providerCheckoutId: true,
        paymentExpiresAt: true,
        paymentRef: true,
        currency: true,
        total: true,
        items: { select: { supplierUrl: true, supplierOrderRef: true } },
      },
    });
    if (!order) return { ok: false, error: "Order not found" };

    if (order.status !== parsed.data.status) {
      const allowed = new Set<z.output<typeof orderStatusSchema>>(
        allowedOrderTransitions[order.status],
      );
      if (!allowed.has(parsed.data.status)) {
        return {
          ok: false,
          error: `Orders cannot move from ${order.status} to ${parsed.data.status}`,
        };
      }

      if (parsed.data.status === "FULFILLED" &&
        order.items.some((item) => item.supplierUrl && !item.supplierOrderRef)) {
        return { ok: false, error: "Record the supplier order reference for every sourced item first" };
      }

      if (parsed.data.status === "REFUNDED") {
        const refunded = await refundOrder({
          orderId: order.id,
          reason: parsed.data.reason ?? "Requested by administrator",
          requestedById: admin.user.id,
        });
        if (!refunded.ok) return refunded;
        if (refunded.state === "pending") {
          revalidateAdminAndAccounts();
          return { ok: true, data: { id: order.id, status: order.status } };
        }
      } else if (order.status === "PENDING" && parsed.data.status === "CANCELLED") {
        const cancelled = await reconcilePendingOrder(order.id, { cancel: true, force: true });
        if (cancelled.state !== "cancelled") {
          const error = cancelled.state === "paid"
            ? "Payment was already completed; refresh the order"
            : cancelled.state === "active"
              ? "This provider checkout cannot be cancelled while it is active"
              : cancelled.state === "unknown"
                ? cancelled.message
                : "The order changed; refresh and try again";
          return { ok: false, error };
        }
        await prisma.adminAuditLog.create({
          data: {
            adminUserId: admin.user.id,
            action: "ORDER_CANCELLED",
            targetType: "Order",
            targetId: order.id,
            metadata: { provider: order.paymentMethod },
          },
        });
      } else {
        const updated = await prisma.$transaction(async (transaction) => {
          if (parsed.data.status === "FULFILLED") {
            const missingSupplierOrders = await transaction.orderItem.count({
              where: {
                orderId: order.id,
                supplierUrl: { not: null },
                supplierOrderRef: null,
              },
            });
            if (missingSupplierOrders > 0) return false;
          }
          const transition = await transaction.order.updateMany({
            where: { id: order.id, status: order.status },
            data: { status: parsed.data.status },
          });
          if (transition.count !== 1) return false;

          await transaction.adminAuditLog.create({
            data: {
              adminUserId: admin.user.id,
              action: "ORDER_STATUS_CHANGED",
              targetType: "Order",
              targetId: order.id,
              metadata: { from: order.status, to: parsed.data.status },
            },
          });
          return true;
        });
        if (!updated) {
          return { ok: false, error: "The order changed; refresh and try again" };
        }
      }
    }

    revalidateAdminAndAccounts();
    return {
      ok: true,
      data: { id: order.id, status: parsed.data.status },
    };
  } catch (error) {
    return mutationError(error, "Could not update order status");
  }
}

export async function updateOrderItemFulfillmentAction(
  input: z.input<typeof updateFulfillmentSchema>,
): Promise<ActionResult<{
  id: string;
  supplierOrderRef: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}>> {
  const admin = await requireAdmin();
  const parsed = updateFulfillmentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error, "Invalid fulfillment details");

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.orderItem.findUnique({
        where: { id: parsed.data.orderItemId },
        select: { id: true, orderId: true, supplierUrl: true, shippedAt: true, order: { select: { status: true } } },
      });
      if (!existing || !["PAID", "FULFILLED", "DELIVERED"].includes(existing.order.status)) {
        return { ok: false as const, error: "Paid order item not found" };
      }
      if (["FULFILLED", "DELIVERED"].includes(existing.order.status) &&
        existing.supplierUrl && !parsed.data.supplierOrderRef) {
        return { ok: false as const, error: "Keep the supplier order reference on fulfilled items" };
      }
      const updated = await transaction.orderItem.update({
        where: { id: existing.id },
        data: {
          supplierOrderRef: parsed.data.supplierOrderRef,
          carrier: parsed.data.carrier,
          trackingNumber: parsed.data.trackingNumber,
          trackingUrl: parsed.data.trackingUrl,
          shippedAt: parsed.data.trackingNumber ? existing.shippedAt ?? new Date() : null,
        },
        select: {
          id: true,
          supplierOrderRef: true,
          carrier: true,
          trackingNumber: true,
          trackingUrl: true,
        },
      });
      await transaction.adminAuditLog.create({
        data: {
          adminUserId: admin.user.id,
          action: "ORDER_ITEM_FULFILLMENT_UPDATED",
          targetType: "OrderItem",
          targetId: existing.id,
          metadata: { orderId: existing.orderId },
        },
      });
      return { ok: true as const, data: updated };
    });
    if (!result.ok) return result;
    revalidateAdminAndAccounts();
    return result;
  } catch (error) {
    return mutationError(error, "Could not update fulfillment details");
  }
}

async function setReviewStatus<Status extends "APPROVED" | "HIDDEN">(
  id: string,
  status: Status,
): Promise<ActionResult<{ id: string; status: Status }>> {
  try {
    const review = await prisma.review.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
    revalidateCatalog();
    return { ok: true, data: { id: review.id, status } };
  } catch (error) {
    return mutationError(error, `Could not mark review as ${status.toLowerCase()}`);
  }
}

export async function updateReviewStatusAction(
  input: z.input<typeof updateReviewStatusSchema>,
): Promise<ActionResult<{ id: string; status: "APPROVED" | "HIDDEN" }>> {
  await requireAdmin();
  const parsed = updateReviewStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error, "Invalid review status");
  return setReviewStatus(parsed.data.reviewId, parsed.data.status);
}

export async function approveReviewAction(
  input: z.input<typeof moderateReviewSchema>,
): Promise<ActionResult<{ id: string; status: "APPROVED" }>> {
  await requireAdmin();
  const parsed = moderateReviewSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error, "Invalid review");
  return setReviewStatus(parsed.data.reviewId, "APPROVED");
}

export async function hideReviewAction(
  input: z.input<typeof moderateReviewSchema>,
): Promise<ActionResult<{ id: string; status: "HIDDEN" }>> {
  await requireAdmin();
  const parsed = moderateReviewSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error, "Invalid review");
  return setReviewStatus(parsed.data.reviewId, "HIDDEN");
}

export async function importAliExpressReviewsAction(
  input: z.input<typeof importReviewsSchema>,
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();
  const parsed = importReviewsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error, "Invalid review import");

  const reviews = parseImportedReviews(parsed.data.data, parsed.data.format);
  if (!reviews.ok) return reviews;

  try {
    const product = await prisma.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true },
    });
    if (!product) return { ok: false, error: "Product not found" };

    const result = await prisma.review.createMany({
      data: reviews.data.map((review) => ({
        productId: product.id,
        authorName: review.author,
        rating: review.rating,
        comment: review.comment,
        images: review.imageUrls,
        source: "ALIEXPRESS" as const,
        status: "PENDING" as const,
      })),
    });
    revalidateCatalog();
    return { ok: true, data: { count: result.count } };
  } catch (error) {
    return mutationError(error, "Could not import reviews");
  }
}

export async function updateStoreSettingsAction(
  input: z.input<typeof storeSettingsSchema>,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = storeSettingsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error, "Invalid store settings");

  const { valueProps, socialLinks, ...scalarSettings } = parsed.data;
  const data = {
    ...scalarSettings,
    ...(valueProps !== undefined
      ? { valueProps: valueProps === null ? Prisma.JsonNull : valueProps }
      : {}),
    ...(socialLinks !== undefined
      ? {
          socialLinks:
            socialLinks === null
              ? Prisma.JsonNull
              : Object.fromEntries(
                  Object.entries(socialLinks).filter(
                    (entry) => entry[1] !== undefined,
                  ),
                ),
        }
      : {}),
  } satisfies Prisma.StoreSettingUpdateInput;

  try {
    const settings = await prisma.storeSetting.upsert({
      where: { id: "main" },
      update: data,
      create: { id: "main", ...data },
      select: { id: true },
    });
    revalidateCatalog();
    return { ok: true, data: settings };
  } catch (error) {
    return mutationError(error, "Could not update store settings");
  }
}
