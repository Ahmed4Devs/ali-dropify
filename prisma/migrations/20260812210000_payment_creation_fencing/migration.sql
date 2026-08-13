-- Add a fencing token to payment-creation leases. Existing in-flight leases
-- receive a stable legacy token so a rolling deployment cannot reclaim them
-- as if payment creation had never started.
ALTER TABLE "Order" ADD COLUMN "paymentLeaseToken" TEXT;

UPDATE "Order"
SET "paymentLeaseToken" = 'legacy-' || "id"
WHERE "paymentCreatingAt" IS NOT NULL;
