import type { Prisma, Purchase, PurchaseStatus } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { recordEvent } from "@/lib/analytics/events";
import { ensureWelcomeCredits } from "./credits";
import { couponPrice } from "./coupon-eligibility";
import { ensureInvoice, validateLinkedInvoice } from "./invoice-creation";
import { PaymentError, paymentProvider, type Invoice, type PaymentProvider } from "./provider";

import { recordPaymentEvent, type PaymentSource } from "./payment-events";
import { hasRefundObservation, processObservedRefund, requiresSettlementReview } from "./refunds";

const expirationMs = 30 * 60_000;
export async function startCheckout(userId: string, productId: string, couponCode: string | undefined, key: string, provider: PaymentProvider = paymentProvider()) {
  const purchase = await db().$transaction(async tx => {
    const existing = await tx.purchase.findUnique({ where: { idempotencyKey: `checkout:${userId}:${key}` }, include: { coupon: true } });
    if (existing) { if (existing.productId !== productId || (existing.coupon?.code ?? "") !== (couponCode?.trim().toUpperCase() ?? "")) throw new PaymentError("مفتاح الطلب مستخدم لشراء مختلف", 409); return existing; }
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product?.active || product.currency !== "SAR") throw new PaymentError("الباقة غير متاحة", 404);
    let amount = product.priceHalalas, couponId: string | undefined;
    if (couponCode) {
      const coupon = await tx.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
      if (!coupon?.active || coupon.expiresAt && coupon.expiresAt <= new Date()) throw new PaymentError("القسيمة غير صالحة", 400);
      await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${coupon.id} FOR UPDATE`;
      const locked = await tx.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
      amount = couponPrice(locked, amount, new Date());
      await tx.coupon.update({ where: { id: coupon.id }, data: { reservedCount: { increment: 1 } } }); couponId = coupon.id;
    }
    const created = await tx.purchase.create({ data: { id: randomUUID(), userId, productId, couponId, couponReserved: Boolean(couponId), status: "PENDING", amountHalalas: amount,
      credits: product.credits, expiresAt: new Date(Date.now() + expirationMs), provider: "moyasar", idempotencyKey: `checkout:${userId}:${key}` } });
    await recordEvent(tx, "PURCHASE_STARTED", userId, { purchaseId: created.id, productId });
    return created;
  });
  if (purchase.status !== "PENDING") return purchase;
  if (purchase.checkoutUrl) return purchase;
  if (purchase.invoiceCreationState === "NOT_CREATED" && purchase.expiresAt && purchase.expiresAt < new Date()) throw new PaymentError("انتهت مهلة الشراء. ابدأ عملية جديدة", 409);
  return ensureInvoice(purchase.id, provider);
}

export async function reconcilePurchase(id: string, provider: PaymentProvider = paymentProvider(), source: PaymentSource = "POLL") {
  let purchase = await db().purchase.findUnique({ where: { id } });
  if (!purchase) throw new PaymentError("الشراء غير موجود", 404);
  if (purchase.status !== "PENDING" && purchase.status !== "PAID") return purchase;
  if (!purchase.providerReference) {
    if (purchase.invoiceCreationState !== "UNKNOWN_OUTCOME") throw new PaymentError("الفاتورة قيد الإنشاء", 409);
    purchase = await ensureInvoice(id, provider);
  }
  if (!purchase.providerReference) throw new PaymentError("الفاتورة قيد الاسترداد", 409);
  const invoice = await provider.fetchInvoice(purchase.providerReference);
  validateLinkedInvoice(purchase, invoice);
  // The locked result, not the pre-lookup read, decides whether a racing PAID
  // settlement needs the existing authoritative refund compensation.
  let reversal = hasRefundObservation(invoice);
  if (purchase.status !== "PAID" || !reversal) purchase = await settleInvoice(id, invoice, source);
  if (purchase.status === "PAID") {
    const settled = await db().paymentEvent.findFirst({ where: { purchaseId: id, provider: "moyasar", eventType: "INVOICE_OBSERVATION",
      processingResult: "SETTLED", observedState: "paid" }, select: { paymentReference: true } });
    reversal = hasRefundObservation(invoice, settled?.paymentReference ?? null);
  }
  if (reversal && purchase.status === "PAID") {
    try { await processObservedRefund(id, invoice, provider, source); }
    catch (error) {
      if (error instanceof PaymentError && error.status === 409) await db().$transaction(tx => recordPaymentEvent(tx, purchase!, { source, eventType: "REFUND_REVIEW", state: invoice.status, result: "REVIEW_REQUIRED" }));
      throw error;
    }
    return db().purchase.findUniqueOrThrow({ where: { id } });
  }
  return purchase;
}

type SettlementStatus = Extract<PurchaseStatus, "PAID" | "FAILED" | "CANCELED" | "EXPIRED" | "VOIDED">;
const invoiceStatuses = new Map<string, SettlementStatus>([["paid", "PAID"], ["failed", "FAILED"], ["canceled", "CANCELED"], ["expired", "EXPIRED"], ["voided", "VOIDED"]]);
const terminalEvents = { PAID: "PURCHASE_COMPLETED", FAILED: "PURCHASE_FAILED", CANCELED: "PURCHASE_CANCELED", EXPIRED: "PURCHASE_EXPIRED", VOIDED: "PURCHASE_VOIDED" } as const;

/** Caller holds the Purchase row lock. The terminal claim and every side effect commit together. */
async function settleLockedPurchase(tx: Prisma.TransactionClient, purchase: Purchase, status: SettlementStatus) {
  if (purchase.status !== "PENDING") return purchase;
  const claimed = await tx.purchase.updateMany({ where: { id: purchase.id, status: "PENDING" },
    data: { status, paidAt: status === "PAID" ? new Date() : null, couponReserved: false } });
  if (claimed.count !== 1) throw new PaymentError("حالة الشراء غير قابلة للتسوية", 409);
  if (purchase.couponReserved) {
    if (!purchase.couponId) throw new PaymentError("حجز القسيمة غير صالح", 409);
    const released = await tx.coupon.updateMany({ where: { id: purchase.couponId, reservedCount: { gte: 1 } },
      data: { reservedCount: { decrement: 1 }, ...(status === "PAID" ? { usedCount: { increment: 1 } } : {}) } });
    // Fail closed on inconsistent legacy data; rollback the claim rather than invent a reservation.
    if (released.count !== 1) throw new PaymentError("حجز القسيمة غير صالح", 409);
  }
  if (status === "PAID") {
    await ensureWelcomeCredits(tx, purchase.userId);
    const inserted = await tx.gameCredit.createMany({ data: [{ userId: purchase.userId, delta: purchase.credits,
      reason: "شراء رصيد ألعاب", idempotencyKey: `purchase:${purchase.id}` }], skipDuplicates: true });
    if (inserted.count === 1) await tx.creditWallet.update({ where: { userId: purchase.userId }, data: { balance: { increment: purchase.credits } } });
  }
  await recordEvent(tx, terminalEvents[status], purchase.userId, { purchaseId: purchase.id, productId: purchase.productId });
  return tx.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
}

export async function settleInvoice(id: string, invoice: Invoice, source: PaymentSource = "SETTLEMENT") {
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Purchase" WHERE id = ${id} FOR UPDATE`;
    const purchase = await tx.purchase.findUnique({ where: { id } });
    if (!purchase) throw new PaymentError("فاتورة غير مطابقة", 409);
    validateLinkedInvoice(purchase, invoice);
    // First terminal result wins, including legacy REFUNDED. Conflicting retries return that authoritative result.
    const status = invoiceStatuses.get(invoice.status);
    if (purchase.status === "PENDING") {
      const review = await tx.paymentEvent.findFirst({ where: { purchaseId: id, provider: "moyasar", processingResult: "REVIEW_REQUIRED",
        eventType: { in: ["REFUND_REVIEW", "INVOICE_OBSERVATION"] } }, select: { id: true } });
      // Never grant reversed funds or forget an earlier reversal when a stale
      // invoice arrives. Ordinary pre-payment VOIDED still settles without credit.
      if (review || requiresSettlementReview(invoice)) {
        await recordPaymentEvent(tx, purchase, { source, eventType: "REFUND_REVIEW", state: invoice.status, result: "REVIEW_REQUIRED" });
        return purchase;
      }
    }
    const result = purchase.status === "PENDING" && status ? await settleLockedPurchase(tx, purchase, status) : purchase;
    await recordPaymentEvent(tx, purchase, { source, eventType: "INVOICE_OBSERVATION", state: invoice.status,
      paymentReference: status === "PAID" && !requiresSettlementReview(invoice) ? invoice.payments?.find(payment => ["paid", "captured"].includes(payment.status))?.id : undefined,
      result: purchase.status === "PENDING" ? status ? "SETTLED" : "PENDING" : status && status !== purchase.status ? "CONFLICT_IGNORED" : "NOOP" });
    return result;
  });
}

export async function expireUninvoicedPurchases() {
  const rows = await db().purchase.findMany({ where: { status: "PENDING", invoiceCreationState: "NOT_CREATED", providerReference: null, expiresAt: { lt: new Date() } }, take: 50 });
  for (const row of rows) await db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Purchase" WHERE id = ${row.id} FOR UPDATE`;
    const current = await tx.purchase.findUniqueOrThrow({ where: { id: row.id } });
    if (current.status !== "PENDING" || current.invoiceCreationState !== "NOT_CREATED" || current.providerReference || !current.expiresAt || current.expiresAt > new Date()) return;
    // Preserve the existing uninvoiced-expiry FAILED result, using the same terminal primitive.
    await settleLockedPurchase(tx, current, "FAILED");
    await recordPaymentEvent(tx, current, { source: "LOCAL_EXPIRY", eventType: "LOCAL_EXPIRY", state: "failed", result: "SETTLED" });
  });
  return rows.length;
}
