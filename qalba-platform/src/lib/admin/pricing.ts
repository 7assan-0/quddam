import { z } from "zod";

export const productSchema = z.strictObject({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,80}$/), title: z.string().trim().min(2).max(100), credits: z.number().int().min(1).max(1000), priceHalalas: z.number().int().min(100).max(10_000_000), active: z.boolean() });
export const couponSchema = z.strictObject({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,40}$/), discountPercent: z.number().int().min(1).max(100).nullable(), discountHalalas: z.number().int().min(1).max(10_000_000).nullable(), maxUses: z.number().int().min(1).max(1_000_000).nullable(), expiresAt: z.iso.datetime().nullable(), active: z.boolean() })
  .refine(input => (input.discountPercent === null) !== (input.discountHalalas === null), "اختر نسبة خصم أو مبلغ خصم واحدًا");
