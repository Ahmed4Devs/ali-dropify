ALTER TABLE "Product"
  ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aliexpressProductId" TEXT;

-- Preserve the visibility of products that were already in the storefront.
UPDATE "Product" SET "isPublished" = true;
UPDATE "Product"
SET "aliexpressProductId" = substring("aliexpressUrl" from '/item/([1-9][0-9]*)\.html')
WHERE "aliexpressUrl" LIKE 'https://%.aliexpress.com/item/%';

ALTER TABLE "Variant"
  ADD COLUMN "aliexpressSkuId" TEXT,
  ADD COLUMN "costUsd" INTEGER;

ALTER TABLE "OrderItem"
  ADD COLUMN "supplierUrl" TEXT,
  ADD COLUMN "supplierProductId" TEXT,
  ADD COLUMN "supplierSkuId" TEXT,
  ADD COLUMN "supplierOrderRef" TEXT,
  ADD COLUMN "carrier" TEXT,
  ADD COLUMN "trackingNumber" TEXT,
  ADD COLUMN "trackingUrl" TEXT,
  ADD COLUMN "shippedAt" TIMESTAMP(3);

CREATE INDEX "Product_aliexpressProductId_idx" ON "Product"("aliexpressProductId");
