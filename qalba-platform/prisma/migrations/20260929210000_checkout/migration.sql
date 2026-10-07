ALTER TABLE "Coupon" ADD COLUMN "reservedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Purchase" ADD COLUMN "credits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "checkoutUrl" VARCHAR(500), ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "couponReserved" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Purchase_status_expiresAt_idx" ON "Purchase"("status", "expiresAt");
