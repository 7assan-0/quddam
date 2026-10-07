import { z } from "zod";

// Deliberately strip card/source/IP/callback fields from provider responses.
const paymentSchema = z.object({ id: z.uuid(), status: z.string(), amount: z.number().int().positive(), currency: z.string(),
  refunded: z.number().int().nonnegative(), captured: z.number().int().nonnegative(), invoice_id: z.uuid().nullable(),
  refunded_at: z.iso.datetime({ offset: true }).nullable().optional(), voided_at: z.iso.datetime({ offset: true }).nullable().optional() });
export type ProviderPayment = z.infer<typeof paymentSchema>;
const invoiceSchema = z.object({ id: z.string().uuid(), status: z.string(), amount: z.number().int(), currency: z.string(), url: z.string().url().optional(), metadata: z.record(z.string(), z.string()).optional(), payments: z.array(paymentSchema).optional() });
export type Invoice = z.infer<typeof invoiceSchema>;
export interface PaymentProvider {
  createInvoice(input: { amount: number; title: string; purchaseId: string; expiresAt: Date }): Promise<Invoice>;
  fetchInvoice(id: string): Promise<Invoice>;
  recoverInvoice?(purchaseId: string): Promise<Invoice | null>;
  fetchPayment?(id: string): Promise<ProviderPayment>;
}
export class PaymentError extends Error { constructor(message: string, public status = 400) { super(message); } }

class MoyasarProvider implements PaymentProvider {
  private async rawRequest(path: string, body?: object) {
    const secret = process.env.MOYASAR_SECRET_KEY;
    if (!secret) throw new PaymentError("بوابة الدفع غير مهيأة بعد", 503);
    const response = await fetch(`https://api.moyasar.com/v1${path}`, { method: body ? "POST" : "GET", headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`, "Content-Type": "application/json",
    }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!response.ok) throw new PaymentError(response.status === 404 ? "فاتورة المزود غير موجودة" : "تعذّر الاتصال ببوابة الدفع. حاول لاحقًا", response.status === 404 ? 404 : 502);
    return response.json();
  }
  private async request(path: string, body?: object) {
    const parsed = invoiceSchema.safeParse(await this.rawRequest(path, body));
    if (!parsed.success) throw new PaymentError("استجابة بوابة الدفع غير صالحة", 502);
    return parsed.data;
  }
  createInvoice(input: { amount: number; title: string; purchaseId: string; expiresAt: Date }) {
    const origin = process.env.APP_URL;
    if (!origin?.startsWith("https://") && process.env.NODE_ENV === "production") throw new PaymentError("رابط التطبيق الآمن غير مهيأ", 503);
    if (!origin) throw new PaymentError("رابط التطبيق غير مهيأ", 503);
    return this.request("/invoices", { amount: input.amount, currency: "SAR", description: input.title,
      callback_url: `${origin}/api/billing/callback?token=${encodeURIComponent(process.env.MOYASAR_CALLBACK_TOKEN ?? "")}`,
      success_url: `${origin}/billing/return?purchase=${input.purchaseId}`, back_url: `${origin}/pricing`, expired_at: input.expiresAt.toISOString(),
      metadata: { purchase_id: input.purchaseId } });
  }
  fetchInvoice(id: string) { if (!z.string().uuid().safeParse(id).success) throw new PaymentError("مرجع الفاتورة غير صالح"); return this.request(`/invoices/${id}`); }
  async fetchPayment(id: string) {
    if (!z.uuid().safeParse(id).success) throw new PaymentError("مرجع الدفع غير صالح");
    const parsed = paymentSchema.safeParse(await this.rawRequest(`/payments/${id}`));
    if (!parsed.success) throw new PaymentError("استجابة الدفع غير صالحة", 502);
    return parsed.data;
  }
  async recoverInvoice(purchaseId: string) {
    const query = new URLSearchParams({ "metadata[purchase_id]": purchaseId, page: "1" });
    const list = z.object({ invoices: z.array(invoiceSchema), meta: z.object({ next_page: z.number().int().nullable().optional(), total_pages: z.number().int() }) });
    const parsed = list.safeParse(await this.rawRequest(`/invoices?${query}`));
    if (!parsed.success) throw new PaymentError("استجابة الاسترداد غير صالحة", 502);
    // No assumed uniqueness or search visibility guarantee. Ambiguous/incomplete results fail closed.
    if (parsed.data.meta.total_pages > 1 || parsed.data.meta.next_page || parsed.data.invoices.length > 1) throw new PaymentError("استرداد الفاتورة يحتاج مراجعة", 409);
    const candidate = parsed.data.invoices[0];
    if (!candidate) return null;
    if (candidate.metadata?.purchase_id !== purchaseId) throw new PaymentError("فاتورة الاسترداد غير مطابقة", 409);
    const authoritative = await this.fetchInvoice(candidate.id);
    if (authoritative.id !== candidate.id || authoritative.metadata?.purchase_id !== purchaseId) throw new PaymentError("مرجع الاسترداد غير مطابق", 409);
    return authoritative;
  }
}
export function paymentProvider(): PaymentProvider {
  if (!process.env.MOYASAR_SECRET_KEY || !process.env.MOYASAR_CALLBACK_TOKEN || process.env.MOYASAR_CALLBACK_TOKEN.length < 32) throw new PaymentError("بوابة الدفع غير مهيأة بعد", 503);
  return new MoyasarProvider();
}
