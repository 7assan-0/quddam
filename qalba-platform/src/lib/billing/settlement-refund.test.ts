import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Purchase, PurchaseRefund } from "@/generated/prisma/client";
import { reconcilePurchase, settleInvoice } from "./checkout";
import type { Invoice, PaymentProvider, ProviderPayment } from "./provider";
import { POST as callback } from "@/app/api/billing/callback/route";
import { POST as poll } from "@/app/api/billing/purchases/[id]/route";
import { POST as cron } from "@/app/api/billing/reconcile/route";

const mocks = vi.hoisted(() => ({ db: vi.fn(), welcome: vi.fn(), analytics: vi.fn(), currentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./credits", () => ({ ensureWelcomeCredits: mocks.welcome }));
vi.mock("@/lib/analytics/events", () => ({ recordEvent: mocks.analytics }));
vi.mock("@/lib/auth/session", () => ({ currentUser: mocks.currentUser }));

type Ledger = { userId: string; delta: number; reason: string; idempotencyKey: string };
type PaymentEvent = Record<string, unknown> & { provider: string; externalId: string; purchaseId: string; eventType: string; processingResult: string };
type PurchaseUpdate = Omit<Partial<Purchase>, "reconcileAttemptCount"> & { reconcileAttemptCount?: number | { increment: number } };
const invoiceId = "c079f9ce-4882-4a37-8e16-10f9b1cc62cc";
const paymentId = "3645d8ed-dcd9-4b5d-acd7-48f2b32b1e63";

function fixture() {
  const purchase = {
    id: "settlement-refund-purchase", userId: "settlement-refund-user", productId: "settlement-refund-product", couponId: "settlement-refund-coupon",
    status: "PENDING", amountHalalas: 1500, credits: 3, checkoutUrl: `https://checkout.moyasar.com/invoices/${invoiceId}`,
    expiresAt: new Date("2099-01-01"), couponReserved: true, provider: "moyasar", providerReference: invoiceId,
    invoiceCreationState: "CREATED", invoiceCreationAttemptAt: new Date("2026-10-01"), lastReconcileAttemptAt: null,
    nextReconcileAt: new Date("2026-10-01"), reconcileAttemptCount: 0, reconcileLeaseId: null,
    idempotencyKey: "settlement-refund-checkout", createdAt: new Date("2026-10-01"), paidAt: null,
  } as Purchase;
  const state = { purchase, balance: 0, coupon: { reservedCount: 1, usedCount: 0 }, ledger: [] as Ledger[], events: [] as PaymentEvent[], refunds: [] as PurchaseRefund[] };
  const matches = (event: PaymentEvent, where: Record<string, unknown>): boolean => Object.entries(where).every(([key, value]) => {
    if (key === "OR") return (value as Record<string, unknown>[]).some(part => matches(event, part));
    if (value && typeof value === "object" && "in" in value) return (value.in as unknown[]).includes(event[key]);
    return event[key] === value;
  });
  const tx = {
    $queryRaw: vi.fn(async (...query: unknown[]) => { void query; return [] as { id: string }[]; }),
    purchase: {
      findUnique: vi.fn(async () => structuredClone(state.purchase)),
      findUniqueOrThrow: vi.fn(async () => structuredClone(state.purchase)),
      findMany: vi.fn(async ({ where }: { where: { invoiceCreationState?: string; id?: { in: string[] } } }) => {
        if (where.invoiceCreationState && state.purchase.invoiceCreationState !== where.invoiceCreationState) return [];
        return !where.id || where.id.in.includes(state.purchase.id) ? [structuredClone(state.purchase)] : [];
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { status?: string; reconcileLeaseId?: string }; data: PurchaseUpdate }) => {
        if (where.status && state.purchase.status !== where.status) return { count: 0 };
        if (where.reconcileLeaseId && state.purchase.reconcileLeaseId !== where.reconcileLeaseId) return { count: 0 };
        const { reconcileAttemptCount, ...fields } = data;
        Object.assign(state.purchase, fields);
        if (typeof reconcileAttemptCount === "number") state.purchase.reconcileAttemptCount = reconcileAttemptCount;
        else if (reconcileAttemptCount) state.purchase.reconcileAttemptCount += reconcileAttemptCount.increment;
        return { count: 1 };
      }),
    },
    coupon: { updateMany: vi.fn(async ({ data }: { data: { reservedCount: { decrement: number }; usedCount?: { increment: number } } }) => {
      state.coupon.reservedCount -= data.reservedCount.decrement;
      state.coupon.usedCount += data.usedCount?.increment ?? 0; return { count: 1 };
    }) },
    gameCredit: {
      findUnique: vi.fn(async ({ where }: { where: { idempotencyKey: string } }) => structuredClone(state.ledger.find(entry => entry.idempotencyKey === where.idempotencyKey) ?? null)),
      create: vi.fn(async ({ data }: { data: Ledger }) => { state.ledger.push(structuredClone(data)); return data; }),
      createMany: vi.fn(async ({ data }: { data: Ledger[] }) => {
        const fresh = data.filter(entry => !state.ledger.some(prior => prior.idempotencyKey === entry.idempotencyKey));
        state.ledger.push(...structuredClone(fresh)); return { count: fresh.length };
      }),
    },
    creditWallet: {
      findUnique: vi.fn(async () => ({ userId: state.purchase.userId, balance: state.balance })),
      update: vi.fn(async ({ data }: { data: { balance: { increment: number } } }) => {
        state.balance += data.balance.increment; return { userId: state.purchase.userId, balance: state.balance };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { balance: { gte: number } }; data: { balance: { decrement: number } } }) => {
        if (state.balance < where.balance.gte) return { count: 0 };
        state.balance -= data.balance.decrement; return { count: 1 };
      }),
    },
    purchaseRefund: {
      findUnique: vi.fn(async () => structuredClone(state.refunds[0] ?? null)),
      create: vi.fn(async ({ data }: { data: PurchaseRefund }) => { state.refunds.push(structuredClone(data)); return data; }),
    },
    paymentEvent: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => state.events.find(event => matches(event, where)) ?? null),
      createMany: vi.fn(async ({ data }: { data: PaymentEvent[] }) => {
        const fresh = data.filter(event => !state.events.some(prior => prior.provider === event.provider && prior.externalId === event.externalId));
        state.events.push(...structuredClone(fresh)); return { count: fresh.length };
      }),
    },
  };
  const database = { ...tx, $transaction: vi.fn(async (run: (transaction: typeof tx) => Promise<unknown>) => {
    const before = structuredClone(state);
    try { return await run(tx); }
    catch (error) { Object.assign(state, before); throw error; }
  }) };
  mocks.db.mockReturnValue(database);
  mocks.currentUser.mockResolvedValue({ id: state.purchase.userId, role: "USER" });
  const payment: ProviderPayment = { id: paymentId, invoice_id: invoiceId, status: "refunded", amount: 1500, currency: "SAR", refunded: 1500,
    captured: 0, refunded_at: "2026-10-06T00:00:00.000Z" };
  const invoice: Invoice = { id: invoiceId, status: "paid", amount: 1500, currency: "SAR", metadata: { purchase_id: purchase.id }, payments: [payment] };
  const financial = () => structuredClone({ purchase: { id: state.purchase.id, status: state.purchase.status, paidAt: state.purchase.paidAt,
    amountHalalas: state.purchase.amountHalalas, credits: state.purchase.credits, couponReserved: state.purchase.couponReserved,
    providerReference: state.purchase.providerReference, invoiceCreationState: state.purchase.invoiceCreationState },
  balance: state.balance, coupon: state.coupon, ledger: state.ledger, refunds: state.refunds });
  const paidInvoice: Invoice = { ...invoice, payments: [{ ...payment, status: "paid", refunded: 0, refunded_at: null }] };
  const provider: PaymentProvider = { createInvoice: vi.fn(async () => { throw new Error("Unexpected invoice creation"); }),
    fetchInvoice: vi.fn(async () => invoice), fetchPayment: vi.fn(async () => payment) };
  return { state, tx, database, payment, invoice, paidInvoice, provider, financial };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("All network access is denied in settlement regression tests"); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("pending settlement after provider reversal", () => {
  it("does not grant a pending purchase when its paid invoice contains a fully refunded payment", async () => {
    const f = fixture(), before = f.financial();
    const result = await settleInvoice(f.state.purchase.id, f.invoice);
    expect(result.status).toBe("PENDING");
    expect(f.financial()).toEqual(before);
    expect(mocks.welcome).not.toHaveBeenCalled();
    expect(mocks.analytics).not.toHaveBeenCalled();
    expect(f.state.events).toEqual([expect.objectContaining({ purchaseId: f.state.purchase.id, eventType: "REFUND_REVIEW", processingResult: "REVIEW_REQUIRED" })]);
  });

  it.each(["partial", "voided", "reversed payment", "reversed invoice", "refunded invoice", "ambiguous"])("holds %s observations without guessing a financial result", async kind => {
    const f = fixture(), before = f.financial();
    const invoice = reversal(f, kind);
    expect((await settleInvoice(f.state.purchase.id, invoice)).status).toBe("PENDING");
    expect(f.financial()).toEqual(before);
    expect(mocks.welcome).not.toHaveBeenCalled();
    expect(mocks.analytics).not.toHaveBeenCalled();
    expect(f.state.events).toEqual([expect.objectContaining({ eventType: "REFUND_REVIEW", processingResult: "REVIEW_REQUIRED" })]);
  });

  it.each(["full refund", "partial refund", "reversed", "duplicate void identity", "captured"])("does not discard %s evidence behind a voided invoice status", async kind => {
    const f = fixture(), before = f.financial();
    const voided: ProviderPayment = { ...f.payment, status: "voided", refunded: 0, captured: 0, refunded_at: null, voided_at: "2026-10-06T00:00:00.000Z" };
    const payments = kind === "full refund" ? [f.payment]
      : kind === "partial refund" ? [{ ...voided, refunded: 100 }]
      : kind === "reversed" ? [{ ...voided, status: "reversed" }]
      : kind === "captured" ? [{ ...voided, captured: 1500 }]
      : [voided, { ...voided }];
    expect((await settleInvoice(f.state.purchase.id, { ...f.invoice, status: "voided", payments }, "CALLBACK")).status).toBe("PENDING");
    expect(f.financial()).toEqual(before);
    expect(f.state.events).toEqual([expect.objectContaining({ eventType: "REFUND_REVIEW", processingResult: "REVIEW_REQUIRED" })]);
    expect((await settleInvoice(f.state.purchase.id, f.paidInvoice, "POLL")).status).toBe("PENDING");
    expect(f.financial()).toEqual(before);
    expect(mocks.welcome).not.toHaveBeenCalled();
    expect(mocks.analytics).not.toHaveBeenCalled();
  });

  it("retains normal pre-payment void settlement for one uncaptured, unrefunded voided payment", async () => {
    const f = fixture();
    const invoice: Invoice = { ...f.invoice, status: "voided", payments: [{ ...f.payment, status: "voided", refunded: 0, captured: 0, refunded_at: null,
      voided_at: "2026-10-06T00:00:00.000Z" }] };
    expect((await settleInvoice(f.state.purchase.id, invoice)).status).toBe("VOIDED");
    expect(f.state.purchase.paidAt).toBeNull();
    expect(f.state.balance).toBe(0);
    expect(f.state.ledger).toEqual([]);
    expect(f.state.coupon).toEqual({ reservedCount: 0, usedCount: 0 });
    expect(f.state.events.every(event => event.processingResult !== "REVIEW_REQUIRED")).toBe(true);
    expect(mocks.welcome).not.toHaveBeenCalled();
    expect(mocks.analytics).toHaveBeenCalledTimes(1);
    const beforeRetry = f.financial();
    await settleInvoice(f.state.purchase.id, f.paidInvoice);
    expect(f.financial()).toEqual(beforeRetry);
  });

  it.each(["paid", "initiated", "failed", "canceled", "expired", "voided"])("does not release a held purchase on a later stale %s invoice", async status => {
    const f = fixture(), before = f.financial();
    await settleInvoice(f.state.purchase.id, f.invoice, "CALLBACK");
    expect((await settleInvoice(f.state.purchase.id, { ...f.paidInvoice, status, payments: undefined }, "POLL")).status).toBe("PENDING");
    expect(f.financial()).toEqual(before);
    expect(mocks.analytics).not.toHaveBeenCalled();
  });

  it("preserves a legacy pending invoice-observation review hold", async () => {
    const f = fixture(), before = f.financial();
    f.state.events.push({ provider: "moyasar", externalId: "legacy-pending-review", purchaseId: f.state.purchase.id,
      eventType: "INVOICE_OBSERVATION", processingResult: "REVIEW_REQUIRED" });
    expect((await settleInvoice(f.state.purchase.id, f.paidInvoice)).status).toBe("PENDING");
    expect(f.financial()).toEqual(before);
  });

  it("does not apply another purchase's review hold", async () => {
    const f = fixture();
    f.state.events.push({ provider: "moyasar", externalId: "another-purchase-review", purchaseId: "another-purchase",
      eventType: "REFUND_REVIEW", processingResult: "REVIEW_REQUIRED" });
    expect((await settleInvoice(f.state.purchase.id, f.paidInvoice)).status).toBe("PAID");
    expect(f.state.balance).toBe(3);
  });

  it("deduplicates repeated reviews per source using the real payment-event identity", async () => {
    const f = fixture(), before = f.financial();
    for (let attempt = 0; attempt < 5; attempt++) {
      for (const source of ["SETTLEMENT", "CALLBACK", "POLL", "CRON"] as const) await settleInvoice(f.state.purchase.id, f.invoice, source);
    }
    expect(f.financial()).toEqual(before);
    expect(f.state.events).toHaveLength(4);
    expect(new Set(f.state.events.map(event => event.externalId)).size).toBe(4);
    expect(f.state.events.every(event => event.processingResult === "REVIEW_REQUIRED")).toBe(true);
  });

  it("cannot grant if persisting its review fails", async () => {
    const f = fixture(), before = f.financial();
    f.tx.paymentEvent.createMany.mockRejectedValueOnce(new Error("Synthetic review persistence failure"));
    await expect(settleInvoice(f.state.purchase.id, f.invoice)).rejects.toThrow("Synthetic review persistence failure");
    expect(f.financial()).toEqual(before);
    expect(f.state.events).toEqual([]);
    expect(mocks.welcome).not.toHaveBeenCalled();
  });

  it.each(["paid", "failed", "canceled", "expired", "voided"])("preserves ordinary %s terminal settlement and exactly-once side effects", async status => {
    const f = fixture();
    const invoice = { ...f.paidInvoice, status, payments: status === "paid" ? f.paidInvoice.payments : [] };
    await settleInvoice(f.state.purchase.id, invoice);
    const after = f.financial();
    for (let attempt = 0; attempt < 5; attempt++) await settleInvoice(f.state.purchase.id, invoice);
    expect(f.financial()).toEqual(after);
    expect(f.state.purchase.status).toBe(status.toUpperCase());
    expect(f.state.balance).toBe(status === "paid" ? 3 : 0);
    expect(f.state.ledger).toHaveLength(status === "paid" ? 1 : 0);
    expect(f.state.coupon).toEqual({ reservedCount: 0, usedCount: status === "paid" ? 1 : 0 });
    expect(mocks.analytics).toHaveBeenCalledTimes(1);
  });

  it.each(["provider", "id", "amount", "currency", "merchant identity", "missing merchant identity"])("rejects a mismatched %s before recording a hold or changing finances", async kind => {
    const f = fixture();
    if (kind === "provider") f.state.purchase.provider = "other";
    const before = f.financial();
    const invoice = { ...f.invoice, ...(kind === "id" ? { id: paymentId } : kind === "amount" ? { amount: 1 } : kind === "currency" ? { currency: "USD" }
      : kind === "merchant identity" ? { metadata: { purchase_id: "foreign" } } : kind === "missing merchant identity" ? { metadata: undefined } : {}) };
    await expect(settleInvoice(f.state.purchase.id, invoice)).rejects.toMatchObject({ status: 409 });
    expect(f.financial()).toEqual(before);
    expect(f.state.events).toEqual([]);
  });
});

function reversal(f: ReturnType<typeof fixture>, kind: string): Invoice {
  if (kind === "partial") return { ...f.invoice, payments: [{ ...f.payment, status: "paid", refunded: 100 }] };
  if (kind === "voided") return { ...f.invoice, payments: [{ ...f.payment, status: "voided", refunded: 0, voided_at: "2026-10-06T00:00:00.000Z" }] };
  if (kind === "reversed payment") return { ...f.invoice, payments: [{ ...f.payment, status: "reversed", refunded: 0 }] };
  if (kind === "reversed invoice") return { ...f.invoice, status: "reversed", payments: undefined };
  if (kind === "refunded invoice") return { ...f.invoice, status: "refunded", payments: undefined };
  if (kind === "ambiguous") return { ...f.invoice, payments: [f.payment, { ...f.payment, id: "2140190e-c0f6-438a-afdc-a7d57c74420e", status: "paid", refunded: 0 }] };
  return f.invoice;
}

function historicalVoid(f: ReturnType<typeof fixture>, id = "2140190e-c0f6-438a-afdc-a7d57c74420e"): ProviderPayment {
  return { ...f.payment, id, status: "voided", refunded: 0, captured: 0, refunded_at: null,
    voided_at: "2026-10-02T00:00:00.000Z" };
}

describe("owner-approved historical zero-charge attempts", () => {
  it.each(["one void", "multiple historical attempts"])("settles a paid invoice with %s exactly once without refund processing", async history => {
    const f = fixture(), oldVoid = historicalVoid(f);
    const payments = history === "one void" ? [oldVoid, ...f.paidInvoice.payments!]
      : [oldVoid, { ...oldVoid, id: "1140190e-c0f6-438a-afdc-a7d57c74420e", status: "failed", voided_at: null },
        historicalVoid(f, "3140190e-c0f6-438a-afdc-a7d57c74420e"), ...f.paidInvoice.payments!];
    const invoice = { ...f.paidInvoice, payments };
    const provider = { ...f.provider, fetchInvoice: vi.fn(async () => invoice) };
    for (const source of ["SETTLEMENT", "CALLBACK", "POLL", "CRON"] as const) {
      if (source === "SETTLEMENT") expect((await settleInvoice(f.state.purchase.id, invoice)).status).toBe("PAID");
      else expect((await reconcilePurchase(f.state.purchase.id, provider, source)).status).toBe("PAID");
    }
    const after = f.financial();
    for (let n = 0; n < 3; n++) await reconcilePurchase(f.state.purchase.id, provider);
    expect(f.financial()).toEqual(after);
    expect(f.state.balance).toBe(3); expect(f.state.ledger).toHaveLength(1);
    expect(f.state.coupon).toEqual({ reservedCount: 0, usedCount: 1 });
    expect(f.state.events.every(event => event.processingResult !== "REVIEW_REQUIRED")).toBe(true);
    expect(provider.fetchPayment).not.toHaveBeenCalled();
    expect(mocks.analytics).toHaveBeenCalledTimes(1);
  });

  it.each(["failed", "canceled", "expired", "voided"])("settles a complete %s zero-charge history without credits", async status => {
    const f = fixture();
    const invoice = { ...f.invoice, status, payments: [historicalVoid(f), historicalVoid(f, "3140190e-c0f6-438a-afdc-a7d57c74420e")] };
    expect((await settleInvoice(f.state.purchase.id, invoice)).status).toBe(status.toUpperCase());
    const after = f.financial();
    for (let n = 0; n < 3; n++) await settleInvoice(f.state.purchase.id, f.paidInvoice);
    expect(f.financial()).toEqual(after); expect(f.state.balance).toBe(0); expect(f.state.ledger).toEqual([]);
    expect(f.state.coupon).toEqual({ reservedCount: 0, usedCount: 0 });
    expect(f.state.events.every(event => event.processingResult !== "REVIEW_REQUIRED")).toBe(true);
  });

  it.each(["missing list", "empty paid list", "duplicate identity", "foreign invoice", "foreign currency", "foreign amount",
    "missing captured", "missing refunded", "capture contradiction", "refund timestamp", "unconfirmed void", "active authorization",
    "unknown payment", "two paid payments", "capture timestamp", "partial selected capture", "selected refund timestamp",
    "null history invoice", "unknown invoice"])("holds ambiguous %s data and retains the hold on a clean retry", async kind => {
    const f = fixture(), before = f.financial(), oldVoid = historicalVoid(f), paid = f.paidInvoice.payments![0];
    let payments: Invoice["payments"] = [oldVoid, paid];
    if (kind === "missing list") payments = undefined;
    if (kind === "empty paid list") payments = [];
    if (kind === "duplicate identity") payments = [paid, { ...paid }];
    if (kind === "foreign invoice") payments = [{ ...oldVoid, invoice_id: paymentId }, paid];
    if (kind === "foreign currency") payments = [{ ...oldVoid, currency: "USD" }, paid];
    if (kind === "foreign amount") payments = [{ ...oldVoid, amount: 1 }, paid];
    if (kind === "missing captured") payments = [{ ...oldVoid, captured: undefined } as unknown as ProviderPayment, paid];
    if (kind === "missing refunded") payments = [{ ...oldVoid, refunded: undefined } as unknown as ProviderPayment, paid];
    if (kind === "capture contradiction") payments = [{ ...oldVoid, captured: 1 }, paid];
    if (kind === "refund timestamp") payments = [{ ...oldVoid, refunded_at: "2026-10-02T00:00:00.000Z" }, paid];
    if (kind === "unconfirmed void") payments = [{ ...oldVoid, voided_at: null }, paid];
    if (kind === "active authorization") payments = [{ ...oldVoid, status: "authorized", voided_at: null }, paid];
    if (kind === "unknown payment") payments = [{ ...oldVoid, status: "unsupported", voided_at: null }, paid];
    if (kind === "two paid payments") payments = [{ ...paid, id: oldVoid.id }, paid];
    if (kind === "capture timestamp") payments = [{ ...oldVoid, captured_at: "2026-10-02T00:00:00.000Z" }, paid];
    if (kind === "partial selected capture") payments = [oldVoid, { ...paid, captured: 1 }];
    if (kind === "selected refund timestamp") payments = [oldVoid, { ...paid, refunded_at: "2026-10-02T00:00:00.000Z" }];
    if (kind === "null history invoice") payments = [{ ...oldVoid, invoice_id: null }, paid];
    expect((await settleInvoice(f.state.purchase.id, { ...f.paidInvoice, payments, status: kind === "unknown invoice" ? "unsupported" : "paid" })).status).toBe("PENDING");
    expect(f.financial()).toEqual(before);
    expect(f.state.events.some(event => event.processingResult === "REVIEW_REQUIRED")).toBe(true);
    expect((await settleInvoice(f.state.purchase.id, f.paidInvoice)).status).toBe("PENDING");
    expect(f.financial()).toEqual(before);
  });

  it.each(["paid", "captured"])("holds a terminal void containing %s funds", async status => {
    const f = fixture(), before = f.financial();
    const invoice = { ...f.invoice, status: "voided", payments: [{ ...f.paidInvoice.payments![0], status, captured: 1500 }] };
    expect((await settleInvoice(f.state.purchase.id, invoice)).status).toBe("PENDING");
    expect(f.financial()).toEqual(before);
  });

  it("does not turn ordinary initiated polling into a durable hold", async () => {
    const f = fixture();
    await settleInvoice(f.state.purchase.id, { ...f.paidInvoice, status: "initiated", payments: [{ ...f.paidInvoice.payments![0], status: "initiated" }] });
    expect(f.state.purchase.status).toBe("PENDING");
    expect(f.state.events.every(event => event.processingResult !== "REVIEW_REQUIRED")).toBe(true);
    expect((await settleInvoice(f.state.purchase.id, f.paidInvoice)).status).toBe("PAID");
  });

  it.each(["missing", "empty", "authorized", "historical void", "paid before invoice"])("keeps ordinary in-progress %s observations eligible for later paid settlement", async kind => {
    const f = fixture(), paid = f.paidInvoice.payments![0];
    const payments = kind === "missing" ? undefined : kind === "empty" ? [] : kind === "historical void" ? [historicalVoid(f)]
      : [{ ...paid, status: kind === "authorized" ? "authorized" : "paid" }];
    await settleInvoice(f.state.purchase.id, { ...f.paidInvoice, status: "initiated", payments });
    expect(f.state.events.every(event => event.processingResult !== "REVIEW_REQUIRED")).toBe(true);
    expect((await settleInvoice(f.state.purchase.id, f.paidInvoice)).status).toBe("PAID");
  });

  it.each(["full", "partial"])("preserves %s refund verification beside unrelated zero-charge history", async kind => {
    const f = fixture(), old = historicalVoid(f);
    await settleInvoice(f.state.purchase.id, { ...f.paidInvoice, payments: [old, ...f.paidInvoice.payments!] });
    const invoice = { ...f.invoice, payments: [old, { ...f.payment, refunded: kind === "full" ? 1500 : 1 }] };
    const provider = { ...f.provider, fetchInvoice: vi.fn(async () => invoice), fetchPayment: vi.fn(async () => invoice.payments[1]) };
    if (kind === "partial") {
      const before = f.financial();
      await expect(reconcilePurchase(f.state.purchase.id, provider)).rejects.toMatchObject({ status: 409 });
      expect(f.financial()).toEqual(before); expect(f.state.refunds).toEqual([]);
    } else {
      await reconcilePurchase(f.state.purchase.id, provider);
      const before = f.financial();
      for (let n = 0; n < 3; n++) await reconcilePurchase(f.state.purchase.id, provider);
      expect(f.financial()).toEqual(before); expect(f.state.balance).toBe(0);
      expect(f.state.ledger).toHaveLength(2); expect(f.state.refunds).toHaveLength(1);
    }
  });

  it("refuses a stale historical void as compensation for a different recorded paid payment", async () => {
    const f = fixture(), old = historicalVoid(f);
    await settleInvoice(f.state.purchase.id, { ...f.paidInvoice, payments: [old, ...f.paidInvoice.payments!] });
    const before = f.financial(), invoice = { ...f.invoice, status: "voided", payments: [old] };
    const provider = { ...f.provider, fetchInvoice: vi.fn(async () => invoice), fetchPayment: vi.fn(async () => old) };
    await expect(reconcilePurchase(f.state.purchase.id, provider)).rejects.toMatchObject({ status: 409 });
    expect(f.financial()).toEqual(before);
  });

  it("compensates the recorded automatic paid payment when it later becomes voided beside older voids", async () => {
    const f = fixture(), old = historicalVoid(f);
    await settleInvoice(f.state.purchase.id, { ...f.paidInvoice, payments: [old, ...f.paidInvoice.payments!] });
    const actual = { ...f.paidInvoice.payments![0], status: "voided", voided_at: "2026-10-06T00:00:00.000Z" };
    const invoice = { ...f.invoice, status: "voided", payments: [old, actual] };
    const provider = { ...f.provider, fetchInvoice: vi.fn(async () => invoice), fetchPayment: vi.fn(async () => actual) };
    await reconcilePurchase(f.state.purchase.id, provider);
    const before = f.financial();
    for (let n = 0; n < 3; n++) await reconcilePurchase(f.state.purchase.id, provider);
    expect(f.financial()).toEqual(before); expect(f.state.balance).toBe(0); expect(f.state.refunds).toHaveLength(1);
    expect(f.state.refunds[0].paymentReference).toBe(paymentId); expect(f.state.refunds[0].state).toBe("VOIDED");
  });

  it.each(["REFUND_REVIEW", "INVOICE_OBSERVATION"])("retains %s holds for all entry sources even when a snapshot is newly eligible", async eventType => {
    const f = fixture(), before = f.financial();
    f.state.events.push({ provider: "moyasar", externalId: "synthetic-persisted-hold", purchaseId: f.state.purchase.id, eventType, processingResult: "REVIEW_REQUIRED" });
    for (const source of ["SETTLEMENT", "CALLBACK", "POLL", "CRON"] as const) {
      await settleInvoice(f.state.purchase.id, { ...f.paidInvoice, payments: [historicalVoid(f), ...f.paidInvoice.payments!] }, source);
      await settleInvoice(f.state.purchase.id, { ...f.invoice, status: "voided", payments: [historicalVoid(f)] }, source);
    }
    expect(f.financial()).toEqual(before);
  });
});

describe("reconciliation after a concurrent paid settlement", () => {
  it("uses the locked result to verify and compensate when its initial pending read became paid", async () => {
    const f = fixture();
    const originalGrant: Ledger = { userId: f.state.purchase.userId, delta: 3, reason: "Original paid grant", idempotencyKey: `purchase:${f.state.purchase.id}` };
    f.tx.$queryRaw.mockImplementationOnce(async () => {
      Object.assign(f.state.purchase, { status: "PAID", paidAt: new Date("2026-10-05"), couponReserved: false });
      f.state.balance = 3; f.state.coupon = { reservedCount: 0, usedCount: 1 }; f.state.ledger.push(originalGrant);
      return [];
    });
    const result = await reconcilePurchase(f.state.purchase.id, f.provider, "CALLBACK");
    expect(result.status).toBe("PAID");
    expect(result.paidAt).toEqual(new Date("2026-10-05"));
    expect(f.provider.fetchPayment).toHaveBeenCalledExactlyOnceWith(paymentId);
    expect(f.state.balance).toBe(0);
    expect(f.state.ledger).toEqual([originalGrant, expect.objectContaining({ delta: -3, idempotencyKey: `purchase-refund:${f.state.purchase.id}:full` })]);
    expect(f.state.refunds).toEqual([expect.objectContaining({ state: "REFUNDED", recoveredCredits: 3, unresolvedCredits: 0 })]);
    expect(f.state.coupon).toEqual({ reservedCount: 0, usedCount: 1 });
    expect(mocks.welcome).not.toHaveBeenCalled();
    expect(mocks.analytics).not.toHaveBeenCalled();
    const beforeRetry = f.financial();
    await reconcilePurchase(f.state.purchase.id, f.provider, "POLL");
    expect(f.financial()).toEqual(beforeRetry);
  });

  it.each(["partial", "reversed payment", "reversed invoice", "ambiguous"])("does not invent compensation for an already-paid %s observation", async kind => {
    const f = fixture();
    await settleInvoice(f.state.purchase.id, f.paidInvoice);
    const before = f.financial();
    const invoice = reversal(f, kind);
    const provider: PaymentProvider = { ...f.provider, fetchInvoice: vi.fn(async () => invoice), fetchPayment: vi.fn(async () => invoice.payments?.[0] ?? f.payment) };
    await expect(reconcilePurchase(f.state.purchase.id, provider, "POLL")).rejects.toMatchObject({ status: 409 });
    expect(f.financial()).toEqual(before);
    expect(f.state.refunds).toEqual([]);
    expect(f.state.events.some(event => event.eventType === "REFUND_REVIEW" && event.processingResult === "REVIEW_REQUIRED")).toBe(true);
  });
});

function syntheticProvider(f: ReturnType<typeof fixture>, invoice: Invoice) {
  // These are fixed synthetic constants; the test never reads an injected merchant credential.
  vi.stubEnv("MOYASAR_SECRET_KEY", "synthetic-unit-test-merchant-key");
  vi.stubEnv("MOYASAR_CALLBACK_TOKEN", "synthetic-callback-token-".repeat(2));
  vi.stubEnv("BILLING_CRON_SECRET", "synthetic-cron-token-".repeat(2));
  vi.stubEnv("APP_URL", "https://quddam.test");
  const fetcher = vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (options?.method !== "GET" || options.body) throw new Error("Only synthetic provider GETs are allowed");
    if (url === `https://api.moyasar.com/v1/invoices/${invoiceId}`) return Response.json(invoice);
    if (url === `https://api.moyasar.com/v1/payments/${paymentId}`) return Response.json(f.payment);
    throw new Error("Unexpected provider destination; external access is denied");
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

describe("actual billing HTTP entry points", () => {
  it.each(["callback", "poll", "cron"])("%s accepts a verified paid payment beside unrelated zero-charge history", async route => {
    const f = fixture(), invoice = { ...f.paidInvoice, payments: [historicalVoid(f), ...f.paidInvoice.payments!] };
    const fetcher = syntheticProvider(f, invoice);
    let response: Response;
    if (route === "callback") response = await callback(new NextRequest(`https://quddam.test/api/billing/callback?token=${"synthetic-callback-token-".repeat(2)}`, {
      method: "POST", body: JSON.stringify({ id: invoiceId }),
    }));
    else if (route === "poll") response = await poll(new NextRequest(`https://quddam.test/api/billing/purchases/${f.state.purchase.id}`, {
      method: "POST", headers: { Origin: "https://quddam.test" },
    }), { params: Promise.resolve({ id: f.state.purchase.id }) });
    else {
      f.tx.$queryRaw.mockImplementation(async (...query) => (query[0] as TemplateStringsArray).join("?").includes("LIMIT 50") && !f.state.purchase.reconcileLeaseId ? [{ id: f.state.purchase.id }] : []);
      response = await cron(new NextRequest("https://quddam.test/api/billing/reconcile", { method: "POST", headers: { Authorization: `Bearer ${"synthetic-cron-token-".repeat(2)}` } }));
    }
    expect(response.status).toBe(200); expect(f.state.purchase.status).toBe("PAID");
    expect(f.state.balance).toBe(3); expect(f.state.ledger).toHaveLength(1);
    expect(f.state.events.every(event => event.processingResult !== "REVIEW_REQUIRED")).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["missing counter", "invalid timestamp"])("persists a hold after authenticated provider %s data cannot be parsed", async kind => {
    const f = fixture(), before = f.financial();
    const malformed = { ...historicalVoid(f), ...(kind === "missing counter" ? { captured: undefined } : { captured_at: "invalid" }) } as unknown as ProviderPayment;
    syntheticProvider(f, { ...f.paidInvoice, payments: [malformed, ...f.paidInvoice.payments!] });
    const response = await callback(new NextRequest(`https://quddam.test/api/billing/callback?token=${"synthetic-callback-token-".repeat(2)}`, {
      method: "POST", body: JSON.stringify({ id: invoiceId }),
    }));
    expect(response.status).toBe(200);
    expect(f.financial()).toEqual(before);
    expect(f.state.events.some(event => event.processingResult === "REVIEW_REQUIRED")).toBe(true);
    expect((await settleInvoice(f.state.purchase.id, f.paidInvoice)).status).toBe("PENDING");
  });

  it.each(["callback", "poll", "cron"])("%s persists a review and cannot grant an already-refunded pending invoice", async route => {
    const f = fixture(), before = f.financial(), fetcher = syntheticProvider(f, f.invoice);
    let response: Response;
    if (route === "callback") {
      response = await callback(new NextRequest(`https://quddam.test/api/billing/callback?token=${"synthetic-callback-token-".repeat(2)}`, {
        method: "POST", body: JSON.stringify({ id: invoiceId, status: "paid", amount: 1, currency: "USD" }),
      }));
    } else if (route === "poll") {
      response = await poll(new NextRequest(`https://quddam.test/api/billing/purchases/${f.state.purchase.id}`, {
        method: "POST", headers: { Origin: "https://quddam.test" },
      }), { params: Promise.resolve({ id: f.state.purchase.id }) });
    } else {
      f.tx.$queryRaw.mockImplementation(async (...query) => {
        const sql = (query[0] as TemplateStringsArray).join("?");
        if (sql.includes("LIMIT 50") && !f.state.purchase.reconcileLeaseId) return [{ id: f.state.purchase.id }];
        return [];
      });
      response = await cron(new NextRequest("https://quddam.test/api/billing/reconcile", {
        method: "POST", headers: { Authorization: `Bearer ${"synthetic-cron-token-".repeat(2)}` },
      }));
    }
    expect(response.status).toBe(200);
    if (route === "poll") expect(await response.json()).toEqual({ status: "PENDING" });
    if (route === "cron") expect(await response.json()).toMatchObject({ checked: 1, updated: 0, failures: 0, refunds: { checked: 0 } });
    expect(f.financial()).toEqual(before);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(f.state.events).toEqual([expect.objectContaining({ source: route.toUpperCase(), eventType: "REFUND_REVIEW", processingResult: "REVIEW_REQUIRED" })]);
    expect(mocks.welcome).not.toHaveBeenCalled();
    expect(mocks.analytics).not.toHaveBeenCalled();
  });
});
