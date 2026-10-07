/** Native PostgreSQL multi-connection acceptance. Dedicated fixture database only; no live payment calls. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { NextRequest } from "next/server";
import { db } from "../src/lib/db";
import { reconcilePurchase, settleInvoice, startCheckout } from "../src/lib/billing/checkout";
import { reconcilePaidRefundBatch } from "../src/lib/billing/reconciliation";
import { confirmSupportRefund } from "../src/lib/billing/refunds";
import { createBoardSession, eligibleBoardCategories, applyBoardCommand } from "../src/lib/games/category-board/service";
import { POST as callback } from "../src/app/api/billing/callback/route";
import { PaymentError, type Invoice, type PaymentProvider, type ProviderPayment } from "../src/lib/billing/provider";

async function main() {
  assert.equal(process.env.BILLING_TEST_DATABASE, "1"); assert.ok(Number(process.env.DATABASE_POOL_MAX) >= 4);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const server = (await pool.query("SELECT version() AS version")).rows[0].version;
  assert.match(server, /^PostgreSQL /); assert.doesNotMatch(server, /PGlite/i);
  const results: object[] = [];
  const product = await db().product.create({ data: { slug: randomUUID(), title: "Full refund fixture", credits: 3, priceHalalas: 1500, active: true } });
  const admin = await db().user.create({ data: { email: `${randomUUID()}@example.test`, name: "Support fixture", role: "ADMIN" } });
  await db().featureFlag.upsert({ where: { key: "welcome-credits" }, create: { key: "welcome-credits", enabled: false, config: { count: 0 } }, update: { enabled: false, config: { count: 0 } } });
  async function fixture(paid = true) {
    const user = await db().user.create({ data: { email: `${randomUUID()}@example.test`, name: "Refund fixture" } });
    const coupon = await db().coupon.create({ data: { code: randomUUID().toUpperCase(), active: true, discountPercent: 10, maxUses: 1, reservedCount: 1 } });
    const invoiceId = randomUUID(), purchaseId = randomUUID();
    const payment: ProviderPayment = { id: randomUUID(), invoice_id: invoiceId, status: "refunded", amount: 1350, currency: "SAR", refunded: 1350, captured: 0, refunded_at: "2026-10-06T00:00:00.000Z" };
    const invoice: Invoice = { id: invoiceId, status: "paid", amount: 1350, currency: "SAR", metadata: { purchase_id: purchaseId }, payments: [payment] };
    const purchase = await db().purchase.create({ data: { id: purchaseId, userId: user.id, productId: product.id, couponId: coupon.id, couponReserved: true,
      provider: "moyasar", providerReference: invoiceId, amountHalalas: 1350, credits: 3, invoiceCreationState: "CREATED", invoiceCreationAttemptAt: new Date(), idempotencyKey: randomUUID() } });
    if (paid) await settleInvoice(purchase.id, { ...invoice, payments: [{ ...payment, status: "paid", refunded: 0 }] });
    const provider: PaymentProvider = { async createInvoice() { throw new Error("Never create on refund"); }, async fetchInvoice(id) { assert.equal(id, invoice.id); return invoice; }, async fetchPayment(id) { assert.equal(id, payment.id); return payment; } };
    return { user, coupon, purchase, invoice, payment, provider };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  async function financial(f: Fixture) {
    const purchase = await db().purchase.findUniqueOrThrow({ where: { id: f.purchase.id } });
    const grant = await db().gameCredit.findUnique({ where: { idempotencyKey: `purchase:${purchase.id}` } });
    const coupon = await db().coupon.findUniqueOrThrow({ where: { id: f.coupon.id }, select: { usedCount: true, reservedCount: true } });
    const wallet = await db().creditWallet.findUnique({ where: { userId: f.user.id } });
    const ledgers = await db().gameCredit.findMany({ where: { userId: f.user.id }, orderBy: { id: "asc" } });
    const refund = await db().purchaseRefund.findUnique({ where: { purchaseId: purchase.id } });
    return { purchase, grant, coupon, wallet, ledgers, refund };
  }
  async function consume(f: Fixture, amount: number) {
    // Represents consumption before the refund. The concurrency scenario below uses the real START engine.
    await db().$transaction(async tx => {
      await tx.creditWallet.update({ where: { userId: f.user.id }, data: { balance: { decrement: amount } } });
      await tx.gameCredit.create({ data: { userId: f.user.id, delta: -amount, reason: "Native consumed fixture", idempotencyKey: randomUUID() } });
    });
  }
  async function assertRefund(f: Fixture, recovered: number, unresolved: number) {
    const s = await financial(f); assert.equal(s.purchase.status, "PAID"); assert.ok(s.purchase.paidAt);
    assert.equal(s.refund?.state, "REFUNDED"); assert.equal(s.refund?.recoveredCredits, recovered); assert.equal(s.refund?.unresolvedCredits, unresolved);
    assert.equal(s.refund?.supportStatus, unresolved ? "SUPPORT_REQUIRED" : "RESOLVED");
    const compensation = s.ledgers.filter(l => l.idempotencyKey === `purchase-refund:${f.purchase.id}:full`);
    assert.equal(compensation.length, 1); assert.equal(compensation[0].delta, recovered ? -recovered : 0);
    assert.deepEqual(s.coupon, { usedCount: 1, reservedCount: 0 }); assert.ok((s.wallet?.balance ?? -1) >= 0);
    assert.equal(await db().analyticsEvent.count({ where: { name: "PURCHASE_COMPLETED", properties: { path: ["purchaseId"], equals: f.purchase.id } } }), 1);
    return { purchaseStatus: s.purchase.status, refundState: s.refund!.state, recovered, unresolved, balance: s.wallet!.balance, compensations: compensation.length };
  }
  async function race(table: "Purchase" | "CreditWallet", key: string, tasks: (() => Promise<unknown>)[]) {
    const gate = await pool.connect(); await gate.query("BEGIN");
    await gate.query(`SELECT * FROM "${table}" WHERE "${table === "Purchase" ? "id" : "userId"}"=$1 FOR UPDATE`, [key]);
    const running: Promise<PromiseSettledResult<unknown>>[] = []; let pids: number[] = [];
    try {
      for (const task of tasks) {
        running.push(task().then(value => ({ status: "fulfilled" as const, value }), reason => ({ status: "rejected" as const, reason })));
        const deadline = Date.now() + 4500;
        do {
          pids = (await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1", [`%${table}%`])).rows.map(r => Number(r.pid));
          if (pids.length >= running.length) break;
          await new Promise(r => setTimeout(r, 20));
        } while (Date.now() < deadline);
        assert.equal(pids.length, running.length); assert.equal(new Set(pids).size, running.length);
      }
      await gate.query("COMMIT"); return { pids, outcomes: await Promise.all(running) };
    } catch (error) { await gate.query("ROLLBACK"); await Promise.all(running); throw error; } finally { gate.release(); }
  }
  const run = async (name: string, fn: () => Promise<unknown>) => { const evidence = await fn(); results.push({ name, status: "passed", evidence }); console.log("PASS", name); };
  const support = (f: Fixture) => confirmSupportRefund(f.purchase.id, f.invoice.id, f.payment.id, admin.id, f.provider);
  const observed = (f: Fixture, source: "POLL" | "CRON" = "POLL") => reconcilePurchase(f.purchase.id, f.provider, source);
  try {
    for (const [used, name] of [[0, "A full unused credits"], [2, "B partly consumed"], [3, "C fully consumed"]] as const) await run(name, async () => {
      const f = await fixture(), original = await financial(f); if (used) await consume(f, used);
      await support(f); const result = await assertRefund(f, 3 - used, used);
      assert.deepEqual((await financial(f)).grant, original.grant); assert.deepEqual((await financial(f)).purchase, original.purchase); return result;
    });
    await run("D terminal retries are immutable including later wallet top-up", async () => {
      const f = await fixture(); await consume(f, 3); await support(f); const before = await financial(f);
      await db().$transaction(async tx => { await tx.creditWallet.update({ where: { userId: f.user.id }, data: { balance: { increment: 2 } } }); await tx.gameCredit.create({ data: { userId: f.user.id, delta: 2, reason: "Later fixture grant", idempotencyKey: randomUUID() } }); });
      for (let i = 0; i < 12; i++) { assert.equal((await support(f)).duplicate, true); await observed(f); }
      const after = await financial(f); assert.deepEqual(after.refund, before.refund); assert.deepEqual(after.grant, before.grant); assert.equal(after.wallet!.balance, 2);
      assert.equal(await db().paymentEvent.count({ where: { purchaseId: f.purchase.id, source: "SUPPORT", eventType: "SUPPORT_CONFIRMATION" } }), 1);
      return assertRefund(f, 0, 3);
    });
    await run("E multi-connection concurrent support full refund", async () => {
      const f = await fixture(), before = await financial(f);
      const r = await race("Purchase", f.purchase.id, [() => support(f), () => support(f), () => observed(f)]);
      assert.ok(r.outcomes.every(x => x.status === "fulfilled")); assert.deepEqual((await financial(f)).grant, before.grant);
      return { backendPids: r.pids, ...await assertRefund(f, 3, 0) };
    });
    await run("F real callback plus cron plus support race", async () => {
      const f = await fixture(), originalFetch = globalThis.fetch;
      process.env.MOYASAR_SECRET_KEY = "synthetic-contract-fixture"; process.env.MOYASAR_CALLBACK_TOKEN = "c".repeat(40);
      globalThis.fetch = async input => { const url = String(input); if (url === `https://api.moyasar.com/v1/invoices/${f.invoice.id}`) return Response.json(f.invoice); assert.equal(url, `https://api.moyasar.com/v1/payments/${f.payment.id}`); return Response.json({ ...f.payment, source: { token: "sentinel-private", number: "sentinel-card" } }); };
      try {
        const r = await race("Purchase", f.purchase.id, [() => callback(new NextRequest(`http://localhost/api/billing/callback?token=${process.env.MOYASAR_CALLBACK_TOKEN}`, { method: "POST", body: JSON.stringify({ id: randomUUID(), type: "payment_refunded", data: { id: f.payment.id, invoice_id: f.invoice.id, amount: 1, currency: "USD" }, secret_token: "sentinel-private" }) })), () => observed(f, "CRON"), () => support(f)]);
        assert.ok(r.outcomes.every(x => x.status === "fulfilled")); assert.equal((r.outcomes[0] as PromiseFulfilledResult<Response>).value.status, 200);
        const events = await db().paymentEvent.findMany({ where: { purchaseId: f.purchase.id } });
        assert.ok(["CALLBACK", "CRON", "SUPPORT"].every(source => events.some(e => e.source === source && e.eventType === "REFUND_CONFIRMED")));
        assert.doesNotMatch(JSON.stringify(events), /sentinel|secret_token|card|rawBody/);
        return { backendPids: r.pids, sourceEvents: events.map(e => e.source), ...await assertRefund(f, 3, 0) };
      } finally { globalThis.fetch = originalFetch; }
    });
    for (const status of ["failed", "canceled", "expired", "voided"] as const) await run(`G ${status} never-paid rejected`, async () => {
      const f = await fixture(false); await settleInvoice(f.purchase.id, { ...f.invoice, status, payments: undefined }); const before = await financial(f);
      await assert.rejects(support(f), { status: 409 }); assert.deepEqual(await financial(f), before); return { unchanged: true };
    });
    const patches = [
      { name: "provider", purchase: { provider: "foreign" } },
      { name: "invoice reference", invoice: { id: randomUUID() } },
      { name: "merchant identity", invoice: { metadata: { purchase_id: "foreign" } } },
      { name: "invoice amount", invoice: { amount: 1 } },
      { name: "invoice currency", invoice: { currency: "USD" } },
      { name: "payment reference", payment: { id: randomUUID() } },
      { name: "payment invoice", payment: { invoice_id: randomUUID() } },
      { name: "payment amount", payment: { amount: 1 } },
      { name: "payment currency", payment: { currency: "USD" } },
      { name: "partial refund", payment: { refunded: 1 } },
      { name: "no verified refund", payment: { status: "paid", refunded: 0 } },
    ];
    for (const patch of patches) await run(`H fails closed: ${patch.name}`, async () => {
      const f = await fixture(); if (patch.purchase) await db().purchase.update({ where: { id: f.purchase.id }, data: patch.purchase });
      const before = await financial(f), provider = { ...f.provider, async fetchInvoice() { return { ...f.invoice, ...patch.invoice }; }, async fetchPayment() { return { ...f.payment, ...patch.payment }; } };
      await assert.rejects(confirmSupportRefund(f.purchase.id, f.invoice.id, f.payment.id, admin.id, provider), { status: 409 }); assert.deepEqual(await financial(f), before); return { unchanged: true };
    });
    await run("I nonexistent purchase is 404", async () => { const f = await fixture(); await assert.rejects(confirmSupportRefund("unknown", f.invoice.id, f.payment.id, admin.id, f.provider), { status: 404 }); return { status: 404 }; });
    await run("J refund before PAID cannot mutate financial state", async () => {
      const f = await fixture(false), before = await financial(f); await assert.rejects(support(f), { status: 409 });
      await reconcilePurchase(f.purchase.id, { ...f.provider, async fetchInvoice() { return { ...f.invoice, status: "refunded" }; } });
      assert.deepEqual(await financial(f), before); return { unchanged: true, noGrant: true };
    });
    await run("K rollback on refund-record failure leaves original paid grant intact", async () => {
      const f = await fixture(), before = await financial(f);
      await pool.query(`CREATE FUNCTION test_refund_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected transaction abort'; END $$; CREATE TRIGGER test_refund_abort BEFORE INSERT ON "PurchaseRefund" FOR EACH ROW EXECUTE FUNCTION test_refund_abort();`);
      try { await assert.rejects(support(f)); assert.deepEqual(await financial(f), before); } finally { await pool.query('DROP TRIGGER test_refund_abort ON "PurchaseRefund"; DROP FUNCTION test_refund_abort()'); }
      await support(f); assert.deepEqual((await financial(f)).grant, before.grant); return assertRefund(f, 3, 0);
    });
    for (const first of ["START", "REFUND"] as const) await run(`L native actual START/refund race ${first} first`, async () => {
      const f = await fixture(); const categories = await eligibleBoardCategories(); assert.ok(categories.length >= 6);
      const game = await createBoardSession(f.user.id, { categoryIds: categories.slice(0, 6).map(c => c.id), teamNames: ["ألف", "باء"], timerSeconds: 30 });
      const key = randomUUID(), start = () => applyBoardCommand(f.user.id, game.id, key, game.version, { type: "START" });
      const r = await race("CreditWallet", f.user.id, first === "START" ? [start, () => support(f)] : [() => support(f), start]);
      const startOutcome = r.outcomes[first === "START" ? 0 : 1], refundOutcome = r.outcomes[first === "START" ? 1 : 0]; assert.equal(refundOutcome.status, "fulfilled");
      const started = startOutcome.status === "fulfilled"; assert.equal(started, first === "START");
      if (!started) assert.equal((startOutcome as PromiseRejectedResult).reason.status, 402);
      const savedGame = await db().gameSession.findUniqueOrThrow({ where: { id: game.id } });
      assert.equal(savedGame.status, started ? "IN_PROGRESS" : "LOBBY"); assert.equal(savedGame.stateVersion, game.version + (started ? 1 : 0));
      assert.equal(await db().gameCommand.count({ where: { sessionId: game.id } }), started ? 1 : 0);
      assert.equal(await db().gameCredit.count({ where: { idempotencyKey: `game-start:${game.id}` } }), started ? 1 : 0);
      if (started) { await start(); assert.equal(await db().gameCredit.count({ where: { idempotencyKey: `game-start:${game.id}` } }), 1); }
      return { backendPids: r.pids, started, ...await assertRefund(f, started ? 2 : 3, started ? 1 : 0) };
    });
    await run("events: same state bounded across callback poll cron and settlement", async () => {
      const f = await fixture(); const paid = { ...f.invoice, payments: [{ ...f.payment, status: "paid", refunded: 0 }] };
      for (let i = 0; i < 15; i++) for (const source of ["SETTLEMENT", "CALLBACK", "POLL", "CRON"] as const) await settleInvoice(f.purchase.id, paid, source);
      const events = await db().paymentEvent.findMany({ where: { purchaseId: f.purchase.id } }); assert.equal(events.length, 4);
      assert.equal(new Set(events.map(e => e.externalId)).size, 4); assert.ok(events.every(e => e.processedAt && e.purchaseId && !Object.hasOwn(e, "body")));
      return { observations: 60, retainedEvents: 4, sources: events.map(e => e.source) };
    });
    await run("events: durable unknown-outcome intent and recovered invoice source", async () => {
      const f = await fixture(); let calls = 0; let remote: Invoice | undefined;
      const provider: PaymentProvider = { async createInvoice(input) { calls++; remote = { id: randomUUID(), status: "initiated", amount: input.amount, currency: "SAR", metadata: { purchase_id: input.purchaseId }, url: "https://checkout.moyasar.com/invoices/recovered-fixture" }; throw new Error("lost response"); }, async recoverInvoice() { return remote ?? null; }, async fetchInvoice() { return remote!; } };
      const key = randomUUID(); await assert.rejects(startCheckout(f.user.id, product.id, undefined, key, provider));
      const p = await db().purchase.findUniqueOrThrow({ where: { idempotencyKey: `checkout:${f.user.id}:${key}` } });
      assert.equal(p.invoiceCreationState, "UNKNOWN_OUTCOME");
      assert.equal(await db().paymentEvent.count({ where: { purchaseId: p.id, source: "CHECKOUT", eventType: "INVOICE_CREATION_INTENT" } }), 1);
      await startCheckout(f.user.id, product.id, undefined, key, provider); await startCheckout(f.user.id, product.id, undefined, key, provider); assert.equal(calls, 1);
      assert.equal(await db().paymentEvent.count({ where: { purchaseId: p.id, source: "RECOVERY", eventType: "INVOICE_RECOVERED" } }), 1);
      return { creations: calls, durableIntent: true, recoveryAudit: true };
    });
    await run("paid refund queue remains bounded, leased and separate from M02", async () => {
      await db().purchase.updateMany({ where: { status: "PAID" }, data: { nextReconcileAt: new Date("2099-01-01") } });
      const f = await fixture(); let release!: () => void, entered!: () => void;
      const gate = new Promise<void>(r => { release = r; }), waiting = new Promise<void>(r => { entered = r; });
      const one = reconcilePaidRefundBatch({ ...f.provider, async fetchInvoice(id) { entered(); await gate; return f.provider.fetchInvoice(id); } });
      await waiting; const two = await reconcilePaidRefundBatch(f.provider); assert.equal(two.checked, 0); release();
      assert.deepEqual(await one, { checked: 1, confirmed: 1, failures: 0 }); assert.equal((await reconcilePaidRefundBatch(f.provider, new Date("2098-01-01"))).checked, 0);
      return { competingCronChecked: 0, refundLeavesQueue: true, ...await assertRefund(f, 3, 0) };
    });
    await run("paid monitoring 11 purchases uses 10/1 batches and concurrency at most 3", async () => {
      await db().purchase.updateMany({ where: { status: "PAID" }, data: { nextReconcileAt: new Date("2099-01-01") } });
      const items = []; for (let i = 0; i < 11; i++) items.push(await fixture());
      let active = 0, max = 0;
      const byReference = new Map(items.map(f => [f.invoice.id, f]));
      const provider: PaymentProvider = { async createInvoice() { throw new Error("unexpected"); }, async fetchInvoice(id) {
        const f = byReference.get(id)!; active++; max = Math.max(max, active); await new Promise(r => setTimeout(r, 10));
        try { return { ...f.invoice, payments: [{ ...f.payment, status: "paid", refunded: 0 }] }; } finally { active--; }
      } };
      const first = await reconcilePaidRefundBatch(provider), second = await reconcilePaidRefundBatch(provider);
      assert.equal(first.checked, 10); assert.equal(second.checked, 1); assert.ok(max <= 3); assert.equal((await reconcilePaidRefundBatch(provider)).checked, 0);
      for (const f of items) { const p = await db().purchase.findUniqueOrThrow({ where: { id: f.purchase.id } }); assert.ok(p.nextReconcileAt.getTime() >= p.lastReconcileAttemptAt!.getTime() + 3600000); }
      return { batches: [first.checked, second.checked], maxConcurrent: max, minimumDelayMs: 3600000 };
    });
    await run("provider failure is retryable and cannot change paid state or wallet", async () => {
      const f = await fixture(), before = await financial(f);
      await assert.rejects(confirmSupportRefund(f.purchase.id, f.invoice.id, f.payment.id, admin.id, { ...f.provider, async fetchPayment() { throw new PaymentError("temporary provider error", 502); } }), { status: 502 });
      assert.deepEqual(await financial(f), before); return { paidAndWalletUnchanged: true };
    });
    await run("refund invoice and payment HTTP lookups hold no financial row locks", async () => {
      const f = await fixture(); let lookups = 0;
      async function check() { const c = await pool.connect(); try { await c.query("BEGIN"); await c.query('SELECT id FROM "Purchase" WHERE id=$1 FOR UPDATE NOWAIT', [f.purchase.id]); await c.query('SELECT "userId" FROM "CreditWallet" WHERE "userId"=$1 FOR UPDATE NOWAIT', [f.user.id]); await c.query("COMMIT"); lookups++; } finally { c.release(); } }
      await confirmSupportRefund(f.purchase.id, f.invoice.id, f.payment.id, admin.id, { ...f.provider, async fetchInvoice(id) { await check(); return f.provider.fetchInvoice(id); }, async fetchPayment(id) { await check(); return f.provider.fetchPayment!(id); } });
      assert.equal(lookups, 2); return { unlockedProviderLookups: lookups };
    });
    await run("support service rejects USER and suspended ADMIN", async () => {
      const f = await fixture(), before = await financial(f); await assert.rejects(confirmSupportRefund(f.purchase.id, f.invoice.id, f.payment.id, f.user.id, f.provider), { status: 403 });
      await db().user.update({ where: { id: admin.id }, data: { suspendedAt: new Date() } });
      try { await assert.rejects(support(f), { status: 403 }); } finally { await db().user.update({ where: { id: admin.id }, data: { suspendedAt: null } }); }
      assert.deepEqual(await financial(f), before); return { rejected: true };
    });
    await run("confirmed post-PAID full VOID uses same compensating policy", async () => {
      const f = await fixture(); const payment = { ...f.payment, status: "voided", refunded: 0, voided_at: "2026-10-06T00:00:00.000Z" };
      await confirmSupportRefund(f.purchase.id, f.invoice.id, f.payment.id, admin.id, { ...f.provider, async fetchInvoice() { return { ...f.invoice, status: "voided", payments: [payment] }; }, async fetchPayment() { return payment; } });
      const s = await financial(f); assert.equal(s.purchase.status, "PAID"); assert.equal(s.refund!.state, "VOIDED"); assert.equal(s.wallet!.balance, 0); return { originalPaid: true, reversal: "VOIDED" };
    });
  } finally {
    await writeFile(process.env.BILLING_REFUNDS_REPORT ?? "billing-refunds-postgres.json", JSON.stringify({ server, results, passed: results.length, failed: 0, nativeMultiConnection: true }, null, 2));
    await db().$disconnect(); await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
