/** Native PostgreSQL only: run against a dedicated, migrated test database. Never production. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { NextRequest } from "next/server";
import { db } from "../src/lib/db";
import { settleInvoice, reconcilePurchase, startCheckout, expireUninvoicedPurchases } from "../src/lib/billing/checkout";
import { POST as callback } from "../src/app/api/billing/callback/route";
import type { Invoice, PaymentProvider } from "../src/lib/billing/provider";

async function main() {
if (process.env.BILLING_TEST_DATABASE !== "1" || Number(process.env.DATABASE_POOL_MAX) < 4) throw new Error("Requires dedicated native PostgreSQL and DATABASE_POOL_MAX >= 4");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const results: object[] = [];
const server = (await pool.query("SELECT version() AS version")).rows[0].version as string;
assert.match(server, /^PostgreSQL /); assert.doesNotMatch(server, /PGlite/i);
await db().featureFlag.upsert({ where: { key: "welcome-credits" }, create: { key: "welcome-credits", enabled: false, config: { count: 0 } }, update: { enabled: false, config: { count: 0 } } });
const product = await db().product.create({ data: { slug: `race-${randomUUID()}`, title: "Billing race fixture", credits: 3, priceHalalas: 1500, active: true } });
function paidInvoice(invoiceId: string, amount: number, purchaseId: string): Invoice {
  return { id: invoiceId, status: "paid", amount, currency: "SAR", metadata: { purchase_id: purchaseId }, payments: [{
    id: randomUUID(), invoice_id: invoiceId, status: "paid", amount, currency: "SAR", refunded: 0, captured: amount,
    captured_at: "2026-10-13T00:00:00.000Z",
  }] };
}
async function fixture() {
  const user = await db().user.create({ data: { email: `${randomUUID()}@example.test`, name: "Billing fixture" } });
  const coupon = await db().coupon.create({ data: { code: `R-${randomUUID()}`.toUpperCase(), discountPercent: 10, maxUses: 1, active: true, reservedCount: 1 } });
  const purchaseId = randomUUID(), invoice = paidInvoice(randomUUID(), 1350, purchaseId);
  const purchase = await db().purchase.create({ data: { id: purchaseId, userId: user.id, productId: product.id, couponId: coupon.id, couponReserved: true, amountHalalas: invoice.amount, credits: 3, provider: "moyasar", providerReference: invoice.id, idempotencyKey: `race:${randomUUID()}` } });
  return { user, coupon, invoice, purchase };
}
function observation(f: Awaited<ReturnType<typeof fixture>>, status: "paid" | "failed" | "canceled" | "expired" | "voided"): Invoice {
  // Complete synthetic observations preserve the original terminal outcomes under the stricter review gate.
  return { ...f.invoice, status, payments: status === "paid" ? f.invoice.payments : [] };
}
async function snapshot(f: Awaited<ReturnType<typeof fixture>>) {
  const purchase = await db().purchase.findUniqueOrThrow({ where: { id: f.purchase.id } });
  const coupon = await db().coupon.findUniqueOrThrow({ where: { id: f.coupon.id } });
  const grants = await db().gameCredit.count({ where: { idempotencyKey: `purchase:${purchase.id}` } });
  const wallet = await db().creditWallet.findUnique({ where: { userId: f.user.id } });
  const events = await db().analyticsEvent.findMany({ where: { properties: { path: ["purchaseId"], equals: purchase.id }, name: { in: ["PURCHASE_COMPLETED", "PURCHASE_FAILED", "PURCHASE_CANCELED", "PURCHASE_EXPIRED", "PURCHASE_VOIDED"] } }, select: { name: true, properties: true } });
  return { status: purchase.status, reserved: coupon.reservedCount, used: coupon.usedCount, grants, balance: wallet?.balance ?? 0, events };
}
async function check(f: Awaited<ReturnType<typeof fixture>>, status: string) {
  const s = await snapshot(f); const paid = status === "PAID";
  assert.equal(s.status, status); assert.equal(s.reserved, 0); assert.equal(s.used, paid ? 1 : 0); assert.equal(s.grants, paid ? 1 : 0); assert.equal(s.balance, paid ? 3 : 0);
  assert.equal(s.events.length, 1); assert.equal(s.events[0].name, paid ? "PURCHASE_COMPLETED" : `PURCHASE_${status}`);
  assert.deepEqual(s.events[0].properties, { purchaseId: f.purchase.id, productId: product.id });
  return s;
}
/** External connection gates the row; pg_stat_activity proves distinct backends are actually blocked. */
async function race(id: string, tasks: (() => Promise<unknown>)[]) {
  const gate = await pool.connect(); await gate.query("BEGIN"); await gate.query('SELECT id FROM "Purchase" WHERE id=$1 FOR UPDATE', [id]);
  const running: Promise<unknown>[] = []; let pids: number[] = [];
  try {
    for (const task of tasks) {
      running.push(task());
      const deadline = Date.now() + 3500;
      do {
        const waiting = await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%Purchase%' AND query LIKE '%FOR UPDATE%'");
        pids = waiting.rows.map(r => Number(r.pid));
        if (pids.length >= running.length) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      } while (Date.now() < deadline);
      assert.equal(pids.length, running.length, "Each contender must wait on Purchase row lock on its own native backend");
      assert.equal(new Set(pids).size, running.length);
    }
    await gate.query("COMMIT"); return { pids, values: await Promise.all(running) };
  } catch (error) { await gate.query("ROLLBACK"); await Promise.allSettled(running); throw error; }
  finally { gate.release(); }
}
async function scenario(name: string, action: () => Promise<object>) {
  const started = Date.now(); const evidence = await action(); results.push({ name, status: "passed", durationMs: Date.now() - started, ...evidence }); console.log(`PASS ${name}`);
}
try {
  for (const status of ["paid", "failed"] as const) await scenario(`A/B concurrent ${status}`, async () => {
    const f = await fixture(); const r = await race(f.purchase.id, [() => settleInvoice(f.purchase.id, observation(f, status)), () => settleInvoice(f.purchase.id, observation(f, status))]);
    return { backendPids: r.pids, result: await check(f, status.toUpperCase()) };
  });
  for (const first of ["paid", "failed"] as const) await scenario(`C ${first} wins conflicting race`, async () => {
    const f = await fixture(); const r = await race(f.purchase.id, [() => settleInvoice(f.purchase.id, observation(f, first)), () => settleInvoice(f.purchase.id, observation(f, first === "paid" ? "failed" : "paid"))]);
    assert.equal((r.values[0] as {status:string}).status, (r.values[1] as {status:string}).status);
    return { backendPids: r.pids, result: await check(f, first.toUpperCase()) };
  });
  await scenario("D callback plus reconciliation", async () => {
    const f = await fixture(); const original = globalThis.fetch;
    process.env.MOYASAR_SECRET_KEY = "sk_test_fixture"; process.env.MOYASAR_CALLBACK_TOKEN = "fixture-callback-token-".repeat(3);
    globalThis.fetch = async input => { assert.equal(String(input), `https://api.moyasar.com/v1/invoices/${f.invoice.id}`); return Response.json(f.invoice); };
    const provider: PaymentProvider = { async createInvoice() { throw new Error("unexpected create"); }, async fetchInvoice() { return f.invoice; } };
    try {
      const r = await race(f.purchase.id, [() => callback(new NextRequest(`http://localhost/api/billing/callback?token=${process.env.MOYASAR_CALLBACK_TOKEN}`, { method: "POST", body: JSON.stringify({ id: f.invoice.id }) })), () => reconcilePurchase(f.purchase.id, provider)]);
      assert.equal((r.values[0] as Response).status, 200); return { backendPids: r.pids, result: await check(f, "PAID") };
    } finally { globalThis.fetch = original; }
  });
  for (const status of ["paid", "failed", "canceled", "expired", "voided"] as const) await scenario(`E ${status} terminal retries and conflict`, async () => {
    const f = await fixture(); await settleInvoice(f.purchase.id, observation(f, status));
    const before = await snapshot(f);
    for (const next of [status, "paid", "failed", "canceled", "expired", "voided"] as const) assert.equal((await settleInvoice(f.purchase.id, observation(f, next))).status, status.toUpperCase());
    assert.deepEqual(await snapshot(f), before);
    await assert.rejects(settleInvoice(f.purchase.id, { ...f.invoice, id: randomUUID() }));
    await assert.rejects(settleInvoice(f.purchase.id, { ...f.invoice, amount: 1 }));
    return { result: await check(f, status.toUpperCase()) };
  });
  await scenario("F maxUses admission after failed settlement race", async () => {
    const f = await fixture(); await race(f.purchase.id, [() => settleInvoice(f.purchase.id, observation(f, "failed")), () => settleInvoice(f.purchase.id, observation(f, "failed"))]);
    const provider: PaymentProvider = { async createInvoice(input) { return { id: randomUUID(), amount: input.amount, currency: "SAR", metadata: { purchase_id: input.purchaseId }, status: "initiated", url: "https://checkout.moyasar.com/test" }; }, async fetchInvoice() { throw new Error("unexpected fetch"); } };
    const gate = await pool.connect(); await gate.query("BEGIN"); await gate.query('SELECT id FROM "Coupon" WHERE id=$1 FOR UPDATE', [f.coupon.id]);
    const attempts = [startCheckout(f.user.id, product.id, f.coupon.code, randomUUID(), provider), startCheckout(f.user.id, product.id, f.coupon.code, randomUUID(), provider)];
    const settled = Promise.allSettled(attempts);
    let pids: number[] = []; const end = Date.now() + 3500;
    while (Date.now() < end) { pids = (await pool.query("SELECT pid FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%Coupon%' AND query LIKE '%FOR UPDATE%'")).rows.map(r => Number(r.pid)); if(pids.length === 2) break; await new Promise(resolve => setTimeout(resolve, 20)); }
    await gate.query("COMMIT"); gate.release(); assert.equal(pids.length, 2);
    const outcomes = await settled; assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1); assert.equal(outcomes.filter(r => r.status === "rejected").length, 1);
    const winner = outcomes.find(r => r.status === "fulfilled")! as PromiseFulfilledResult<Awaited<ReturnType<typeof startCheckout>>>;
    const winnerInvoice = paidInvoice(winner.value.providerReference!, winner.value.amountHalalas, winner.value.id);
    await race(winner.value.id, [() => settleInvoice(winner.value.id, winnerInvoice), () => reconcilePurchase(winner.value.id, { ...provider, async fetchInvoice() { return winnerInvoice; } })]);
    const c = await db().coupon.findUniqueOrThrow({ where: { id: f.coupon.id } }); assert.equal(c.reservedCount, 0); assert.equal(c.usedCount, 1);
    await assert.rejects(startCheckout(f.user.id, product.id, f.coupon.code, randomUUID(), provider)); return { backendPids: pids, reserved: c.reservedCount, used: c.usedCount, maxUses: c.maxUses };
  });
  await scenario("G constraints, unlimited coupons and fail-closed rollback", async () => {
    const f = await fixture(); await assert.rejects(db().coupon.update({ where: { id: f.coupon.id }, data: { reservedCount: -1 } })); await assert.rejects(db().coupon.update({ where: { id: f.coupon.id }, data: { usedCount: -1 } }));
    await db().coupon.update({ where: { id: f.coupon.id }, data: { reservedCount: 0 } });
    await assert.rejects(settleInvoice(f.purchase.id, f.invoice)); const s = await snapshot(f); assert.equal(s.status, "PENDING"); assert.equal(s.grants, 0); assert.equal(s.events.length, 0);
    await db().coupon.update({ where: { id: f.coupon.id }, data: { maxUses: null, usedCount: 1000, reservedCount: 1 } });
    await settleInvoice(f.purchase.id, f.invoice); const c = await db().coupon.findUniqueOrThrow({ where: { id: f.coupon.id } }); assert.equal(c.usedCount, 1001); assert.equal(c.reservedCount, 0); return { rollback: s, unlimitedUsed: c.usedCount };
  });
  await scenario("H local expiry concurrency uses same terminal primitive", async () => {
    const f = await fixture(); await db().purchase.update({ where: { id: f.purchase.id }, data: { providerReference: null, expiresAt: new Date(Date.now()-1000) } });
    const r = await race(f.purchase.id, [() => expireUninvoicedPurchases(), () => expireUninvoicedPurchases()]); return { backendPids: r.pids, result: await check(f, "FAILED") };
  });
} finally {
  await writeFile(process.env.BILLING_EVIDENCE_FILE ?? "billing-settlement-postgres.json", JSON.stringify({ server, results, passed: results.length }, null, 2));
  await db().$disconnect(); await pool.end();
}

}
main().catch(error => { console.error(error); process.exitCode = 1; });
