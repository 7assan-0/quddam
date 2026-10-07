import { z } from "zod";
import type { Purchase, PurchaseRefund } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { validateLinkedInvoice } from "./invoice-creation";
import { recordPaymentEvent, type PaymentSource } from "./payment-events";
import { PaymentError, paymentProvider, type Invoice, type PaymentProvider, type ProviderPayment } from "./provider";

export function hasRefundObservation(invoice: Invoice) {
  return invoice.status === "refunded" || invoice.status === "voided" || Boolean(invoice.payments?.some(p => p.status === "refunded" || p.status === "voided" || p.refunded > 0));
}
export function validateRefundInvoice(purchase: Purchase, invoice: Invoice) {
  validateLinkedInvoice(purchase, invoice);
  // Even legacy purchases need an explicit merchant identity for financial reversal.
  if (invoice.metadata?.purchase_id !== purchase.id) throw new PaymentError("هوية فاتورة الاسترداد غير مطابقة", 409);
}
export function selectRefundPayment(invoice: Invoice) {
  const payments = invoice.payments?.filter(p => ["paid", "captured", "refunded", "voided"].includes(p.status) || p.refunded > 0) ?? [];
  if (payments.length !== 1) throw new PaymentError("الاسترداد يحتاج عملية دفع واحدة موثقة", 409);
  return payments[0];
}
export function validateFullRefundPayment(invoice: Invoice, payment: ProviderPayment, expectedPaymentId: string) {
  if (payment.id !== expectedPaymentId || payment.invoice_id !== invoice.id || payment.amount !== invoice.amount || payment.currency !== invoice.currency ||
      payment.refunded > payment.amount || payment.captured > payment.amount) throw new PaymentError("عملية الاسترداد غير مطابقة", 409);
  if (payment.status === "refunded" && payment.refunded === payment.amount) return "REFUNDED" as const;
  // Previously PAID is checked under lock. No pre-payment authorization void is compensated.
  if (payment.status === "voided" && payment.voided_at && payment.refunded === 0 && (payment.captured === 0 || payment.captured === payment.amount)) return "VOIDED" as const;
  throw new PaymentError("تدعم هذه النسخة استرداد الشراء كاملًا فقط بعد تأكيد المزود", 409);
}
export function refundCreditSplit(grant: number, balance: number) {
  if (!Number.isSafeInteger(grant) || grant < 0 || !Number.isSafeInteger(balance) || balance < 0) throw new PaymentError("سجل الرصيد غير صالح", 409);
  const recovered = Math.min(grant, balance);
  return { recovered, unresolved: grant - recovered };
}
export function refundSummary(refund: PurchaseRefund, duplicate = false) {
  return { purchaseId: refund.purchaseId, state: refund.state, amountHalalas: refund.amountHalalas, recoveredCredits: refund.recoveredCredits,
    unresolvedCredits: refund.unresolvedCredits, supportStatus: refund.supportStatus, duplicate };
}
async function requireSupportAdmin(operatorId: string) {
  const user = await db().user.findUnique({ where: { id: operatorId }, select: { role: true, suspendedAt: true } });
  if (user?.role !== "ADMIN" || user.suspendedAt) throw new PaymentError("غير مصرح", 403);
}

/** Every HTTP lookup is before the transaction; only authenticated provider GET data reaches the compensation. */
export async function processObservedRefund(id: string, invoice: Invoice, provider: PaymentProvider, source: PaymentSource, support?: { operatorId: string; paymentReference: string }) {
  if (source === "SUPPORT" && !support || source !== "SUPPORT" && support) throw new PaymentError("مصدر الاسترداد غير صالح", 403);
  const before = await db().purchase.findUnique({ where: { id } });
  if (!before) throw new PaymentError("الشراء غير موجود", 404);
  validateRefundInvoice(before, invoice);
  const candidate = selectRefundPayment(invoice);
  if (support && candidate.id !== support.paymentReference) throw new PaymentError("مرجع دعم الاسترداد غير مطابق", 409);
  if (!provider.fetchPayment) throw new PaymentError("التحقق من عملية الدفع غير متاح", 503);
  const payment = await provider.fetchPayment(candidate.id);
  const state = validateFullRefundPayment(invoice, payment, candidate.id);
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Purchase" WHERE id = ${id} FOR UPDATE`;
    const purchase = await tx.purchase.findUniqueOrThrow({ where: { id } });
    validateRefundInvoice(purchase, invoice);
    if (support) {
      const admin = await tx.user.findUnique({ where: { id: support.operatorId }, select: { role: true, suspendedAt: true } });
      if (admin?.role !== "ADMIN" || admin.suspendedAt) throw new PaymentError("غير مصرح", 403);
    }
    const grant = await tx.gameCredit.findUnique({ where: { idempotencyKey: `purchase:${id}` } });
    if (purchase.status !== "PAID" || !purchase.paidAt || !grant || grant.userId !== purchase.userId || grant.delta !== purchase.credits || grant.delta < 0) throw new PaymentError("الاسترداد يتطلب شراءً مدفوعًا وسجل منحة مطابقًا", 409);
    const existing = await tx.purchaseRefund.findUnique({ where: { purchaseId: id } });
    if (existing && (existing.paymentReference !== payment.id || existing.providerReference !== invoice.id || existing.state !== state || existing.amountHalalas !== invoice.amount)) throw new PaymentError("استرداد متعارض يحتاج مراجعة الدعم", 409);
    let refund = existing;
    if (!refund) {
      // Same row used by the unchanged conditional START debit. READ COMMITTED re-reads the winning balance.
      await tx.$queryRaw`SELECT "userId" FROM "CreditWallet" WHERE "userId" = ${purchase.userId} FOR UPDATE`;
      const wallet = await tx.creditWallet.findUnique({ where: { userId: purchase.userId } });
      if (!wallet) throw new PaymentError("سجل الرصيد غير موجود", 409);
      const split = refundCreditSplit(grant.delta, wallet.balance), ledgerKey = `purchase-refund:${id}:full`;
      if (split.recovered > 0) {
        const updated = await tx.creditWallet.updateMany({ where: { userId: purchase.userId, balance: { gte: split.recovered } }, data: { balance: { decrement: split.recovered } } });
        if (updated.count !== 1) throw new PaymentError("الرصيد تغيّر. أعد المحاولة", 409);
      }
      // Also record zero compensation for fully consumed purchases: there is no future automatic clawback.
      await tx.gameCredit.create({ data: { userId: purchase.userId, delta: -split.recovered, reason: "تعويض استرداد شراء كامل", idempotencyKey: ledgerKey } });
      refund = await tx.purchaseRefund.create({ data: { purchaseId: id, provider: "moyasar", providerReference: invoice.id, paymentReference: payment.id, state,
        amountHalalas: invoice.amount, currency: invoice.currency, grantedCredits: grant.delta, recoveredCredits: split.recovered, unresolvedCredits: split.unresolved,
        supportStatus: split.unresolved ? "SUPPORT_REQUIRED" : "RESOLVED", ledgerKey, operatorId: support?.operatorId,
        confirmedAt: new Date((state === "REFUNDED" ? payment.refunded_at : payment.voided_at) ?? Date.now()) } });
    }
    await recordPaymentEvent(tx, purchase, { source, eventType: "REFUND_CONFIRMED", state: payment.status, result: existing ? "NOOP" : refund.recoveredCredits > 0 ? "REFUND_APPLIED" : "REFUND_RECORDED", paymentReference: payment.id });
    if (support) await recordPaymentEvent(tx, purchase, { source, eventType: "SUPPORT_CONFIRMATION", state: payment.status, result: existing ? "NOOP" : "REFUND_RECORDED", paymentReference: payment.id, operatorId: support.operatorId });
    return refundSummary(refund, Boolean(existing));
  });
}

/** Confirms a refund already performed at Moyasar; never initiates an external refund or accepts a wallet delta. */
export async function confirmSupportRefund(id: string, invoiceReference: string, paymentReference: string, operatorId: string, provider: PaymentProvider = paymentProvider()) {
  await requireSupportAdmin(operatorId);
  if (!z.uuid().safeParse(invoiceReference).success || !z.uuid().safeParse(paymentReference).success) throw new PaymentError("مرجع غير صالح", 400);
  const purchase = await db().purchase.findUnique({ where: { id } });
  if (!purchase) throw new PaymentError("الشراء غير موجود", 404);
  if (purchase.provider !== "moyasar" || purchase.providerReference !== invoiceReference) throw new PaymentError("مرجع الشراء غير مطابق", 409);
  if (purchase.status !== "PAID") throw new PaymentError("الاسترداد يتطلب شراءً مدفوعًا", 409);
  let invoice: Invoice | undefined;
  try {
    invoice = await provider.fetchInvoice(invoiceReference);
    return await processObservedRefund(id, invoice, provider, "SUPPORT", { operatorId, paymentReference });
  } catch (error) {
    if (error instanceof PaymentError && error.status === 409) await db().$transaction(tx => recordPaymentEvent(tx, purchase, { source: "SUPPORT", eventType: "REFUND_REVIEW", state: invoice?.status ?? "unknown", result: "REVIEW_REQUIRED", operatorId }));
    throw error;
  }
}
