import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { expireUninvoicedPurchases, reconcilePurchase } from "./checkout";
import { PaymentError, paymentProvider, type PaymentProvider } from "./provider";

export const RECONCILE_BATCH = 50;
export const RECONCILE_CONCURRENCY = 3;
const leaseMs = 600_000;
export type ReconcileOutcome = "PENDING" | "TERMINAL" | "TRANSIENT_ERROR" | "NOT_FOUND" | "CREATION_UNKNOWN";
export function reconcileDelay(attempt: number, outcome: ReconcileOutcome) {
  if (outcome === "TERMINAL") return 0;
  // 30s, 60s, 120s ... capped at 15m for pending; errors start at 60s and cap at 1h.
  const pending = outcome === "PENDING";
  return Math.min((pending ? 30_000 : 60_000) * 2 ** Math.min(16, Math.max(0, attempt - 1)), pending ? 900_000 : 3_600_000);
}

export async function reconcileBatch(provider: PaymentProvider = paymentProvider(), now = new Date()) {
  const expired = await expireUninvoicedPurchases();
  const leaseId = randomUUID();
  const purchases = await db().$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Purchase" WHERE status = 'PENDING' AND "nextReconcileAt" <= ${now}
      ORDER BY "nextReconcileAt", "createdAt", id LIMIT 50 FOR UPDATE SKIP LOCKED`;
    if (!rows.length) return [];
    await tx.purchase.updateMany({ where: { id: { in: rows.map(row => row.id) } }, data: { lastReconcileAttemptAt: now, nextReconcileAt: new Date(now.getTime() + leaseMs), reconcileLeaseId: leaseId, reconcileAttemptCount: { increment: 1 } } });
    return tx.purchase.findMany({ where: { id: { in: rows.map(row => row.id) } } });
  });
  let cursor = 0, updated = 0, failures = 0;
  const outcomes: { id: string; outcome: ReconcileOutcome }[] = [];
  await Promise.all(Array.from({ length: Math.min(RECONCILE_CONCURRENCY, purchases.length) }, async () => {
    for (;;) {
      const purchase = purchases[cursor++]; if (!purchase) return;
      let outcome: ReconcileOutcome;
      try { const result = await reconcilePurchase(purchase.id, provider, "CRON"); outcome = result.status === "PENDING" ? "PENDING" : "TERMINAL"; if (outcome === "TERMINAL") updated++; }
      catch (error) { failures++; outcome = !purchase.providerReference ? "CREATION_UNKNOWN" : error instanceof PaymentError && error.status === 404 ? "NOT_FOUND" : "TRANSIENT_ERROR"; }
      outcomes.push({ id: purchase.id, outcome });
      // Lease ownership prevents a delayed worker overwriting a subsequent claim's schedule.
      await db().purchase.updateMany({ where: { id: purchase.id, reconcileLeaseId: leaseId }, data: { reconcileLeaseId: null,
        nextReconcileAt: new Date(Math.max(now.getTime(), Date.now()) + reconcileDelay(purchase.reconcileAttemptCount, outcome)) } });
    }
  }));
  return { checked: purchases.length, updated, expired, failures, outcomes };
}

// Separate bounded queue: paid refund observations cannot consume M02's 50 pending-invoice slots.
export const PAID_REFUND_BATCH = 10;
export const PAID_REFUND_INTERVAL_MS = 3_600_000;
export async function reconcilePaidRefundBatch(provider: PaymentProvider = paymentProvider(), now = new Date()) {
  const leaseId = randomUUID();
  const purchases = await db().$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT p.id FROM "Purchase" p WHERE p.status = 'PAID'
      AND p."providerReference" IS NOT NULL AND p."nextReconcileAt" <= ${now}
      AND NOT EXISTS (SELECT 1 FROM "PurchaseRefund" r WHERE r."purchaseId" = p.id)
      ORDER BY p."nextReconcileAt", p."createdAt", p.id LIMIT 10 FOR UPDATE OF p SKIP LOCKED`;
    if (!rows.length) return [];
    await tx.purchase.updateMany({ where: { id: { in: rows.map(r => r.id) } }, data: { lastReconcileAttemptAt: now,
      nextReconcileAt: new Date(now.getTime() + leaseMs), reconcileLeaseId: leaseId, reconcileAttemptCount: { increment: 1 } } });
    return tx.purchase.findMany({ where: { id: { in: rows.map(r => r.id) } } });
  });
  let cursor = 0, confirmed = 0, failures = 0;
  await Promise.all(Array.from({ length: Math.min(RECONCILE_CONCURRENCY, purchases.length) }, async () => {
    for (;;) {
      const purchase = purchases[cursor++]; if (!purchase) return;
      let delay = PAID_REFUND_INTERVAL_MS;
      try {
        await reconcilePurchase(purchase.id, provider, "CRON");
        if (await db().purchaseRefund.findUnique({ where: { purchaseId: purchase.id } })) confirmed++;
      } catch { failures++; delay = reconcileDelay(purchase.reconcileAttemptCount, "TRANSIENT_ERROR"); }
      await db().purchase.updateMany({ where: { id: purchase.id, reconcileLeaseId: leaseId }, data: { reconcileLeaseId: null,
        nextReconcileAt: new Date(Math.max(now.getTime(), Date.now()) + delay) } });
    }
  }));
  return { checked: purchases.length, confirmed, failures };
}
