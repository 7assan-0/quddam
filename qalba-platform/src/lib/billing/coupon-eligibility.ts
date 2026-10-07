import { PaymentError } from "./provider";

type CouponEligibility = { active: boolean; expiresAt: Date | null; maxUses: number | null; usedCount: number; reservedCount: number; discountPercent: number | null; discountHalalas: number | null };
/** Evaluate the authoritative row only AFTER its lock, using the post-lock clock. */
export function couponPrice(coupon: CouponEligibility, priceHalalas: number, now: Date) {
  if (!coupon.active || coupon.expiresAt && coupon.expiresAt <= now) throw new PaymentError("القسيمة غير صالحة", 400);
  if (coupon.maxUses !== null && coupon.usedCount + coupon.reservedCount >= coupon.maxUses) throw new PaymentError("نفدت القسيمة", 409);
  const amount = priceHalalas - (coupon.discountPercent !== null ? Math.floor(priceHalalas * coupon.discountPercent / 100) : coupon.discountHalalas ?? 0);
  if (amount < 100) throw new PaymentError("لا يمكن شراء باقة تقل عن ريال واحد بعد الخصم", 400);
  return amount;
}
