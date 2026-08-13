-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "checkoutKey" TEXT,
ADD COLUMN "receiptTokenHash" TEXT,
ADD COLUMN "paymentUrl" TEXT,
ADD COLUMN "paymentCreatingAt" TIMESTAMP(3);

ALTER TABLE "Cart" ADD COLUMN "activeCheckoutKey" TEXT;

ALTER TABLE "OrderItem" ADD COLUMN "titleAr" TEXT;
UPDATE "OrderItem" SET "titleAr" = "titleEn" WHERE "titleAr" IS NULL;

-- Backfill pre-existing rows before enforcing the new checkout invariants.
UPDATE "Order"
SET
  "checkoutKey" = 'legacy-checkout-' || "id",
  "receiptTokenHash" = 'legacy-receipt-' || "id";

ALTER TABLE "Order"
ALTER COLUMN "checkoutKey" SET NOT NULL,
ALTER COLUMN "receiptTokenHash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_receiptTokenHash_key" ON "Order"("receiptTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentRef_key" ON "Order"("paymentRef");

-- Only one cart may own an active checkout attempt key.
CREATE UNIQUE INDEX "Cart_activeCheckoutKey_key" ON "Cart"("activeCheckoutKey");

-- Enforce one signed-in cart per user and one base-product line per cart.
CREATE UNIQUE INDEX "Cart_userId_unique_not_null" ON "Cart"("userId") WHERE "userId" IS NOT NULL;
CREATE UNIQUE INDEX "CartItem_base_product_unique" ON "CartItem"("cartId", "productId") WHERE "variantId" IS NULL;

CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");
