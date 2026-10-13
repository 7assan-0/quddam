import { afterEach, describe, expect, it, vi } from "vitest";
import type { Purchase } from "@/generated/prisma/client";
import { hasRefundObservation, refundCreditSplit, selectRefundPayment, validateFullRefundPayment, validateRefundInvoice } from "./refunds";
import { paymentProvider, type Invoice, type ProviderPayment } from "./provider";
import { paymentEventIdentity, safePaymentState } from "./payment-events";
const original = { ...process.env };
afterEach(() => { process.env = { ...original }; vi.unstubAllGlobals(); });
const iid = "c079f9ce-4882-4a37-8e16-10f9b1cc62cc", pid = "3645d8ed-dcd9-4b5d-acd7-48f2b32b1e63";
const payment: ProviderPayment = { id: pid, invoice_id: iid, status: "refunded", amount: 1500, currency: "SAR", refunded: 1500, captured: 0, refunded_at: "2026-10-06T00:00:00.000Z" };
const invoice: Invoice = { id: iid, status: "paid", amount: 1500, currency: "SAR", metadata: { purchase_id: "purchase-1" }, payments: [payment] };
const purchase = { id: "purchase-1", provider: "moyasar", providerReference: iid, amountHalalas: 1500, invoiceCreationAttemptAt: null } as Purchase;
describe("full refund contract", () => {
  it("detects a refund even when the invoice remains paid", () => { expect(hasRefundObservation(invoice)).toBe(true); expect(selectRefundPayment(invoice)).toEqual(payment); expect(validateFullRefundPayment(invoice, payment, pid)).toBe("REFUNDED"); });
  it("does not interpret an unchanged paid invoice as a refund", () => { expect(hasRefundObservation({ ...invoice, payments: [{ ...payment, status: "paid", refunded: 0, refunded_at: null }] })).toBe(false); });
  it("permits failed payment attempts beside the single refunded payment", () => { expect(selectRefundPayment({ ...invoice, payments: [{ ...payment, id: iid, status: "failed", refunded: 0, refunded_at: null }, payment] })).toBe(payment); });
  it.each([{ payments: [] }, { payments: [payment, payment] }])("rejects missing/ambiguous financial payments", ({ payments }) => { expect(() => selectRefundPayment({ ...invoice, payments })).toThrow(); });
  it.each([{ refunded: 100 }, { refunded: 0 }, { refunded: 1501 }, { status: "paid" }, { amount: 1501 }, { currency: "USD" }, { invoice_id: pid }, { id: iid }, { captured: 1501 }])("rejects partial, unconfirmed and mismatched payments %j", patch => { expect(() => validateFullRefundPayment(invoice, { ...payment, ...patch }, pid)).toThrow(); });
  it("recognizes only a documented confirmed full void", () => { expect(validateFullRefundPayment(invoice, { ...payment, status: "voided", refunded: 0, voided_at: "2026-10-06T00:00:00Z" }, pid)).toBe("VOIDED"); expect(() => validateFullRefundPayment(invoice, { ...payment, status: "voided", refunded: 0 }, pid)).toThrow(); });
  it.each([{ provider: "foreign" }, { providerReference: pid }, { amountHalalas: 1 }, { id: "foreign" }])("requires provider/invoice/amount/merchant identity %j", patch => { expect(() => validateRefundInvoice({ ...purchase, ...patch }, invoice)).toThrow(); });
  it("fails closed for legacy invoices without merchant metadata", () => { expect(() => validateRefundInvoice(purchase, { ...invoice, metadata: undefined })).toThrow(); });
  it.each([[3, 3, 3, 0], [3, 1, 1, 2], [3, 0, 0, 3], [3, 8, 3, 0]])("caps grant %d against wallet %d", (grant, balance, recovered, unresolved) => { expect(refundCreditSplit(grant, balance)).toEqual({ recovered, unresolved }); });
  it.each([[-1, 3], [3, -1], [1.5, 2]])("rejects invalid balances", (grant, balance) => { expect(() => refundCreditSplit(grant, balance)).toThrow(); });
  it("fetches authoritative payment with credentials and strips sensitive fields", async () => {
    process.env.MOYASAR_SECRET_KEY = "fake-test-key"; process.env.MOYASAR_CALLBACK_TOKEN = "t".repeat(40);
    const fetcher = vi.fn(async (url: string, options: RequestInit) => { expect(url).toBe(`https://api.moyasar.com/v1/payments/${pid}`); expect(options.method).toBe("GET"); return Response.json({ ...payment, source: { number: "card-data", token: "secret" }, ip: "private", callback_url: "secret" }); }); vi.stubGlobal("fetch", fetcher);
    expect(await paymentProvider().fetchPayment!(pid)).toEqual(payment); expect(fetcher).toHaveBeenCalledOnce();
  });
});
describe("bounded audit identity", () => {
  const event = { purchaseId: "purchase-1", providerReference: iid, source: "CALLBACK" as const, eventType: "INVOICE_OBSERVATION" as const, state: "paid" };
  it("is deterministic, opaque and independent of response bodies", () => { const key = paymentEventIdentity(event); expect(key).toBe(paymentEventIdentity({ ...event })); expect(key).toMatch(/^quddam:v1:[a-f0-9]{64}$/); expect(key).not.toContain("purchase-1"); });
  it("distinguishes poll, callback and cron", () => { expect(new Set(["CALLBACK", "POLL", "CRON"].map(source => paymentEventIdentity({ ...event, source: source as typeof event.source }))).size).toBe(3); });
  it("maps unrecognized provider text to a safe fixed value", () => { expect(safePaymentState("secret-token-or-raw-response")).toBe("unknown"); expect(paymentEventIdentity({ ...event, state: "secret" })).toBe(paymentEventIdentity({ ...event, state: "another secret" })); });
});
