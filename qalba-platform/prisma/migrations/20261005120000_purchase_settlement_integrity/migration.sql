-- Preserve all historical enum values; distinguish provider terminal outcomes going forward.
ALTER TYPE "PurchaseStatus" ADD VALUE 'CANCELED';
ALTER TYPE "PurchaseStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "PurchaseStatus" ADD VALUE 'VOIDED';

-- Validate existing data: do not silently clamp/rewrite historical financial counters.
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_reservedCount_nonnegative" CHECK ("reservedCount" >= 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_usedCount_nonnegative" CHECK ("usedCount" >= 0);
-- No capacity CHECK: maxUses is nullable (unlimited) and admins may lower it below
-- historical usage. Admission is serialized by the existing Coupon FOR UPDATE lock.
