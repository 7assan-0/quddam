import type { Purchase } from "@/generated/prisma/client";
import { recordPaymentEvent } from "./payment-events";
import { db } from "@/lib/db";
import { PaymentError, type Invoice, type PaymentProvider } from "./provider";

export function validateLinkedInvoice(purchase: Purchase, invoice: Invoice) {
  if (purchase.provider !== "moyasar" || invoice.id !== purchase.providerReference || invoice.amount !== purchase.amountHalalas || invoice.currency !== "SAR" ||
      (purchase.invoiceCreationAttemptAt && invoice.metadata?.purchase_id !== purchase.id)) throw new PaymentError("فاتورة غير مطابقة", 409);
}

function validateCandidate(purchase: Purchase, invoice: Invoice) {
  const url = invoice.url ? new URL(invoice.url) : null;
  if (purchase.provider !== "moyasar" || invoice.metadata?.purchase_id !== purchase.id || invoice.amount !== purchase.amountHalalas || invoice.currency !== "SAR" ||
      !url || url.protocol !== "https:" || url.hostname !== "checkout.moyasar.com" || url.username || url.password) throw new PaymentError("فاتورة المزود غير مطابقة", 502);
}

/** The commit precedes HTTP. Once UNKNOWN, no retry may POST another invoice. */
export async function ensureInvoice(id: string, provider: PaymentProvider) {
  const intent = await db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Purchase" WHERE id = ${id} FOR UPDATE`;
    const purchase = await tx.purchase.findUniqueOrThrow({ where: { id } });
    if (purchase.provider !== "moyasar") throw new PaymentError("مزود الشراء غير مطابق", 409);
    if (purchase.status !== "PENDING" || purchase.providerReference) return { purchase, create: false };
    if (purchase.invoiceCreationState !== "NOT_CREATED") return { purchase, create: false };
    if (!purchase.expiresAt || purchase.expiresAt <= new Date()) throw new PaymentError("انتهت مهلة الشراء", 409);
    const claimed = await tx.purchase.update({ where: { id }, data: { invoiceCreationState: "UNKNOWN_OUTCOME", invoiceCreationAttemptAt: new Date() } });
    await recordPaymentEvent(tx, claimed, { source: "CHECKOUT", eventType: "INVOICE_CREATION_INTENT", state: "unknown", result: "PENDING" });
    return { purchase: claimed, create: true };
  });
  if (intent.purchase.status !== "PENDING" || intent.purchase.providerReference) return intent.purchase;
  const invoice = intent.create
    ? await provider.createInvoice({ amount: intent.purchase.amountHalalas, title: `رصيد ألعاب قدّام (${intent.purchase.credits})`, purchaseId: id, expiresAt: intent.purchase.expiresAt! })
    : await provider.recoverInvoice?.(id);
  if (!invoice) throw new PaymentError("نتيجة إنشاء الفاتورة غير مؤكدة. جارٍ الاسترداد دون إنشاء فاتورة إضافية", 409);
  validateCandidate(intent.purchase, invoice);
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Purchase" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.purchase.findUniqueOrThrow({ where: { id } });
    validateCandidate(current, invoice);
    if (current.providerReference && current.providerReference !== invoice.id) throw new PaymentError("مرجع فاتورة متعارض", 409);
    if (current.status !== "PENDING" || current.providerReference) return current;
    if (current.invoiceCreationState !== "UNKNOWN_OUTCOME") throw new PaymentError("نية الفاتورة غير صالحة", 409);
    const linked = await tx.purchase.update({ where: { id }, data: { providerReference: invoice.id, checkoutUrl: invoice.url, invoiceCreationState: "CREATED" } });
    await recordPaymentEvent(tx, linked, { source: intent.create ? "CHECKOUT" : "RECOVERY", eventType: intent.create ? "INVOICE_CREATED" : "INVOICE_RECOVERED", state: invoice.status, result: "LINKED" });
    return linked;
  });
}
