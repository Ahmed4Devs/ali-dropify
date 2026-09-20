-- CreateEnum
CREATE TYPE "PaymentEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'NEEDS_REVIEW');

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "providerCheckoutId" TEXT,
ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);

-- Preserve existing provider identifiers. Pending orders previously stored the hosted
-- checkout identifier in paymentRef; completed PayPal orders stored the PayPal order ID.
UPDATE "Order"
SET "providerCheckoutId" = "paymentRef"
WHERE "paymentRef" IS NOT NULL
  AND ("status" = 'PENDING' OR "paymentMethod" = 'PAYPAL');

UPDATE "Order"
SET "paymentRef" = NULL
WHERE "status" = 'PENDING' AND "providerCheckoutId" IS NOT NULL;

UPDATE "Order"
SET "paymentExpiresAt" = CASE
  WHEN "paymentMethod" = 'PAYPAL' THEN "createdAt" + INTERVAL '3 hours'
  ELSE "createdAt" + INTERVAL '31 minutes'
END
WHERE "status" = 'PENDING' AND "paymentUrl" IS NOT NULL;

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentMethod" NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "PaymentEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "orderId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processingAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "requestedById" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_providerCheckoutId_key" ON "Order"("providerCheckoutId");
CREATE UNIQUE INDEX "PaymentEvent_provider_externalId_key" ON "PaymentEvent"("provider", "externalId");
CREATE INDEX "PaymentEvent_orderId_receivedAt_idx" ON "PaymentEvent"("orderId", "receivedAt");
CREATE INDEX "PaymentEvent_status_updatedAt_idx" ON "PaymentEvent"("status", "updatedAt");
CREATE UNIQUE INDEX "Refund_orderId_key" ON "Refund"("orderId");
CREATE UNIQUE INDEX "Refund_providerRef_key" ON "Refund"("providerRef");
CREATE INDEX "Refund_status_updatedAt_idx" ON "Refund"("status", "updatedAt");
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");
CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx" ON "AdminAuditLog"("targetType", "targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
