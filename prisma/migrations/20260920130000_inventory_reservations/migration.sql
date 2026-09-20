-- CreateEnum
CREATE TYPE "InventoryState" AS ENUM ('NOT_TRACKED', 'RESERVED', 'COMMITTED', 'RELEASED');

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "sku" TEXT,
ADD COLUMN "trackInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stockQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reservedQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Variant"
ADD COLUMN "sku" TEXT,
ADD COLUMN "trackInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stockQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reservedQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "inventoryState" "InventoryState" NOT NULL DEFAULT 'NOT_TRACKED';

-- AlterTable
ALTER TABLE "OrderItem"
ADD COLUMN "variantId" TEXT,
ADD COLUMN "inventoryReserved" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Variant_sku_key" ON "Variant"("sku");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- AddConstraint
ALTER TABLE "Product" ADD CONSTRAINT "Product_stockQuantity_nonnegative" CHECK ("stockQuantity" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_reservedQuantity_valid" CHECK ("reservedQuantity" >= 0 AND "reservedQuantity" <= "stockQuantity");
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_stockQuantity_nonnegative" CHECK ("stockQuantity" >= 0);
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_reservedQuantity_valid" CHECK ("reservedQuantity" >= 0 AND "reservedQuantity" <= "stockQuantity");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_inventoryReserved_nonnegative" CHECK ("inventoryReserved" >= 0 AND "inventoryReserved" <= "quantity");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
