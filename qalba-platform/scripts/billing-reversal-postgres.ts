/** Native acceptance for pre-settlement reversals. Dedicated synthetic DB; fixtures are retained. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { NextRequest } from "next/server";
import { db } from "../src/lib/db";
import { settleInvoice, reconcilePurchase } from "../src/lib/billing/checkout";
import { reconcileBatch } from "../src/lib/billing/reconciliation";
import { createBoardSession, eligibleBoardCategories, applyBoardCommand } from "../src/lib/games/category-board/service";
import { POST as callback } from "../src/app/api/billing/callback/route";
import type { Invoice, PaymentProvider, ProviderPayment } from "../src/lib/billing/provider";

const future = new Date("2099-01-01T00:00:00.000Z");
const delay = () => new Promise<void>(done => setTimeout(done, 20));

async function main() {
  assert.equal(process.env.BILLING_TEST_DATABASE, "1", "Requires explicit synthetic native database authorization");
  const connection = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["postgres:", "postgresql:"].includes(connection.protocol));
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(connection.hostname), "Only loopback database access is allowed");
  assert.equal(connection.pathname, "/financial_p05", "Refuse every other database");
  assert.equal(connection.port, "55465", "Refuse every other PostgreSQL instance");
  assert.equal(decodeURIComponent(connection.username), "quddam_financial_test");
  assert.equal(connection.search, "", "Connection query overrides are prohibited in this dedicated fixture");
  assert.equal(connection.hash, "");
  assert.ok(Number(process.env.DATABASE_POOL_MAX) >= 4 && Number(process.env.DATABASE_POOL_MAX) <= 20);
  process.env.PUBLIC_WELCOME_CREDITS_ENABLED = "false";
  process.env.MOYASAR_SECRET_KEY = "sk_test_p05_synthetic_never_live";
  process.env.MOYASAR_CALLBACK_TOKEN = "p05-synthetic-callback-" + randomUUID();
  const runId = randomUUID();
  const output = resolve(process.env.BILLING_REVERSAL_EVIDENCE_FILE ?? `/tmp/quddam-p05-native-${runId}.json`);
  assert.ok(output.startsWith("/tmp/") || output.startsWith("/workspace/quddam-financial-p05-"), "Evidence belongs outside the repository");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const originalFetch = globalThis.fetch;
  const invoices = new Map<string, Invoice>();
  const payments = new Map<string, ProviderPayment>();
  const fetches: { kind: "invoice" | "payment"; id: string }[] = [];
  // Exercise the real callback/provider boundary without allowing any live or unknown HTTP request.
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    assert.equal(init?.method ?? "GET", "GET", "The fixture never creates payments or refunds");
    const invoice = invoices.get(url);
    if (invoice) { fetches.push({ kind: "invoice", id: invoice.id }); return Response.json(invoice); }
    const payment = payments.get(url);
    if (payment) { fetches.push({ kind: "payment", id: payment.id }); return Response.json(payment); }
    throw new Error("Unknown HTTP destination refused by synthetic payment fixture");
  };
  const results: { name: string; status: "passed" | "failed"; durationMs: number; evidence?: unknown }[] = [];
  const report: { runId: string; status: string; productionAccess: boolean; liveProviderAccess: boolean; destructiveSql: boolean; fixturesRetained: boolean; server?: string; results: typeof results; failure?: string } = {
    runId, status: "FAILED", productionAccess: false, liveProviderAccess: false,
    destructiveSql: false, fixturesRetained: true, results,
  };
  async function scenario(name: string, action: () => Promise<unknown>) {
    const started = Date.now();
    try { const evidence = await action(); results.push({ name, status: "passed", durationMs: Date.now() - started, evidence }); console.log("PASS", name); }
    catch (error) { results.push({ name, status: "failed", durationMs: Date.now() - started }); throw error; }
  }
  try {
    const server = await pool.query("SELECT version() AS version, current_database() AS database, current_user AS role");
    report.server = server.rows[0].version as string;
    assert.match(report.server, /^PostgreSQL /); assert.doesNotMatch(report.server, /PGlite/i);
    assert.equal(server.rows[0].database, "financial_p05"); assert.equal(server.rows[0].role, "quddam_financial_test");
    // Batch reconciliation must never lease or expire another run's existing purchases.
    assert.equal(await db().purchase.count({ where: { status: "PENDING", nextReconcileAt: { lte: new Date() } } }), 0,
      "Preexisting due purchases would make CRON validation mutate unrelated fixtures");
    assert.equal(await db().purchase.count({ where: { status: "PENDING", invoiceCreationState: "NOT_CREATED", providerReference: null, expiresAt: { lt: new Date() } } }), 0);
    if (!await db().featureFlag.findUnique({ where: { key: "welcome-credits" } })) {
      await db().featureFlag.create({ data: { key: "welcome-credits", enabled: false, config: { count: 0 } } });
    }
    const product = await db().product.create({ data: { slug: `p05-${runId}`, title: "Synthetic reversal acceptance", credits: 3, priceHalalas: 1500, active: true } });
    async function fixture() {
      const user = await db().user.create({ data: { email: `p05-${randomUUID()}@example.test`, name: "Synthetic P05 fixture" } });
      await db().creditWallet.create({ data: { userId: user.id, balance: 0 } });
      const coupon = await db().coupon.create({ data: { code: `P05-${randomUUID()}`.toUpperCase(), active: true, discountPercent: 10, maxUses: 1, reservedCount: 1 } });
      const invoiceId = randomUUID(), purchaseId = randomUUID();
      const payment: ProviderPayment = { id: randomUUID(), invoice_id: invoiceId, status: "paid", amount: 1350, currency: "SAR", refunded: 0, captured: 1350 };
      const invoice: Invoice = { id: invoiceId, status: "paid", amount: 1350, currency: "SAR", metadata: { purchase_id: purchaseId }, payments: [payment] };
      const purchase = await db().purchase.create({ data: { id: purchaseId, userId: user.id, productId: product.id, couponId: coupon.id, couponReserved: true,
        provider: "moyasar", providerReference: invoiceId, amountHalalas: invoice.amount, credits: 3, invoiceCreationState: "CREATED",
        invoiceCreationAttemptAt: new Date(), nextReconcileAt: future, expiresAt: future, idempotencyKey: `p05:${randomUUID()}` } });
      return { user, coupon, purchase, invoice, payment };
    }
    type Fixture = Awaited<ReturnType<typeof fixture>>;
    const refunded = (f: Fixture): Invoice => ({ ...f.invoice, payments: [{ ...f.payment, status: "refunded", refunded: f.payment.amount, refunded_at: "2026-10-13T00:00:00.000Z" }] });
    function provider(f: Fixture, invoice: Invoice): PaymentProvider {
      return {
        async createInvoice() { throw new Error("Synthetic reconciliation cannot create an invoice"); },
        async fetchInvoice(id) { assert.equal(id, f.invoice.id); return invoice; },
        async fetchPayment(id) { const payment = invoice.payments?.find(p => p.id === id); assert.ok(payment, "Unknown synthetic payment reference"); return payment; },
      };
    }
    function expose(invoice: Invoice) {
      invoices.set(`https://api.moyasar.com/v1/invoices/${invoice.id}`, invoice);
      for (const payment of invoice.payments ?? []) payments.set(`https://api.moyasar.com/v1/payments/${payment.id}`, payment);
    }
    async function callCallback(f: Fixture, invoice: Invoice) {
      expose(invoice);
      const response = await callback(new NextRequest(`https://p05.invalid/api/billing/callback?token=${process.env.MOYASAR_CALLBACK_TOKEN}`, {
        method: "POST", body: JSON.stringify({ type: "payment_paid", data: { id: f.payment.id, invoice_id: f.invoice.id, amount: 1, currency: "USD", status: "paid" } }),
      }));
      assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
    }
    async function financial(f: Fixture) {
      const purchase = await db().purchase.findUniqueOrThrow({ where: { id: f.purchase.id }, select: { status: true, paidAt: true, couponReserved: true } });
      const coupon = await db().coupon.findUniqueOrThrow({ where: { id: f.coupon.id }, select: { usedCount: true, reservedCount: true } });
      const wallet = await db().creditWallet.findUniqueOrThrow({ where: { userId: f.user.id }, select: { balance: true } });
      const grant = await db().gameCredit.findUnique({ where: { idempotencyKey: `purchase:${f.purchase.id}` }, select: { delta: true } });
      const compensation = await db().gameCredit.findUnique({ where: { idempotencyKey: `purchase-refund:${f.purchase.id}:full` }, select: { delta: true } });
      const refund = await db().purchaseRefund.findUnique({ where: { purchaseId: f.purchase.id }, select: { state: true, grantedCredits: true, recoveredCredits: true, unresolvedCredits: true, supportStatus: true } });
      const completions = await db().analyticsEvent.count({ where: { name: "PURCHASE_COMPLETED", properties: { path: ["purchaseId"], equals: f.purchase.id } } });
      return { purchase, coupon, wallet, grant, compensation, refund, completions };
    }
    async function assertHeld(f: Fixture, before: Awaited<ReturnType<typeof financial>>) {
      assert.deepEqual(await financial(f), before);
      const marks = await db().paymentEvent.findMany({ where: { purchaseId: f.purchase.id, provider: "moyasar", eventType: { in: ["REFUND_REVIEW", "INVOICE_OBSERVATION"] }, processingResult: "REVIEW_REQUIRED" } });
      assert.ok(marks.length >= 1, "Reversal review must survive in the shared database");
      assert.equal(before.purchase.status, "PENDING"); assert.equal(before.wallet.balance, 0); assert.equal(before.grant, null);
      assert.equal(before.coupon.reservedCount, 1); assert.equal(before.coupon.usedCount, 0); assert.equal(before.completions, 0);
      return { status: "PENDING", balance: 0, grants: 0, completionEvents: 0, durableReviewMarkers: marks.length };
    }
    async function staleReplay(f: Fixture, before: Awaited<ReturnType<typeof financial>>) {
      for (const status of ["paid", "initiated", "failed", "canceled", "expired", "voided"]) {
        for (const source of ["SETTLEMENT", "CALLBACK", "POLL", "CRON"] as const) {
          await settleInvoice(f.purchase.id, { ...f.invoice, status }, source);
          await assertHeld(f, before);
        }
      }
      for (let n = 0; n < 3; n++) { await reconcilePurchase(f.purchase.id, provider(f, f.invoice), "POLL"); await callCallback(f, f.invoice); }
      const count = await db().paymentEvent.count({ where: { purchaseId: f.purchase.id } });
      for (let n = 0; n < 3; n++) { await reconcilePurchase(f.purchase.id, provider(f, f.invoice), "POLL"); await callCallback(f, f.invoice); }
      assert.equal(await db().paymentEvent.count({ where: { purchaseId: f.purchase.id } }), count, "Repeated same observations must not grow durable events");
      return assertHeld(f, before);
    }
    async function assertPaid(f: Fixture) {
      const saved = await financial(f);
      assert.equal(saved.purchase.status, "PAID"); assert.ok(saved.purchase.paidAt); assert.equal(saved.purchase.couponReserved, false);
      assert.deepEqual(saved.coupon, { usedCount: 1, reservedCount: 0 }); assert.equal(saved.wallet.balance, 3);
      assert.deepEqual(saved.grant, { delta: 3 }); assert.equal(saved.compensation, null); assert.equal(saved.refund, null); assert.equal(saved.completions, 1);
      return saved;
    }
    async function assertCompensated(f: Fixture, recovered = 3, unresolved = 0) {
      const saved = await financial(f);
      assert.equal(saved.purchase.status, "PAID"); assert.ok(saved.purchase.paidAt); assert.deepEqual(saved.grant, { delta: 3 });
      assert.deepEqual(saved.coupon, { usedCount: 1, reservedCount: 0 }); assert.equal(saved.wallet.balance, 0); assert.equal(saved.completions, 1);
      assert.deepEqual(saved.compensation, { delta: -recovered });
      assert.deepEqual(saved.refund, { state: "REFUNDED", grantedCredits: 3, recoveredCredits: recovered, unresolvedCredits: unresolved, supportStatus: unresolved ? "SUPPORT_REQUIRED" : "RESOLVED" });
      return saved;
    }
    /** Queue order is observed before releasing a separate native connection's row lock. */
    async function race(table: "Purchase" | "CreditWallet", key: string, tasks: (() => Promise<unknown>)[]) {
      const gate = await pool.connect();
      const started: Promise<PromiseSettledResult<unknown>>[] = [];
      let pids: number[] = [];
      await gate.query("BEGIN");
      try {
        await gate.query(`SELECT * FROM "${table}" WHERE "${table === "Purchase" ? "id" : "userId"}"=$1 FOR UPDATE`, [key]);
        const gatePid = Number((await gate.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
        for (const task of tasks) {
          started.push(task().then(value => ({ status: "fulfilled" as const, value }), reason => ({ status: "rejected" as const, reason })));
          const deadline = Date.now() + 3500;
          do {
            const waiting = await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND pid<>$1 AND wait_event_type='Lock' AND query LIKE $2", [gatePid, `%${table}%`]);
            pids = waiting.rows.map(row => Number(row.pid));
            if (pids.length >= started.length) break;
            await delay();
          } while (Date.now() < deadline);
          assert.equal(pids.length, started.length, "Every contender must already wait on its own PostgreSQL backend");
          assert.equal(new Set(pids).size, started.length);
        }
        await gate.query("COMMIT");
        return { gatePid, blockedBackendPids: pids, outcomes: await Promise.all(started) };
      } catch (error) { await gate.query("ROLLBACK"); await Promise.all(started); throw error; }
      finally { gate.release(); }
    }
    const variants: { name: string; invoice: (f: Fixture) => Invoice }[] = [
      { name: "paid/full-refunded payment", invoice: refunded },
      { name: "paid/partial refund numeric evidence", invoice: f => ({ ...f.invoice, payments: [{ ...f.payment, refunded: 1 }] }) },
      { name: "paid/voided payment", invoice: f => ({ ...f.invoice, payments: [{ ...f.payment, status: "voided", captured: 0, voided_at: "2026-10-13T00:00:00.000Z" }] }) },
      { name: "paid/reversed payment", invoice: f => ({ ...f.invoice, payments: [{ ...f.payment, status: "reversed" }] }) },
      { name: "paid/ambiguous multiple payments with reversal", invoice: f => ({ ...refunded(f), payments: [...refunded(f).payments!, { ...f.payment, id: randomUUID() }] }) },
      { name: "refunded invoice", invoice: f => ({ ...refunded(f), status: "refunded" }) },
      { name: "reversed invoice", invoice: f => ({ ...f.invoice, status: "reversed" }) },
      { name: "initiated invoice with refunded payment", invoice: f => ({ ...refunded(f), status: "initiated" }) },
      { name: "voided invoice with fully refunded payment", invoice: f => ({ ...refunded(f), status: "voided" }) },
      { name: "voided invoice with partial refund", invoice: f => ({ ...f.invoice, status: "voided", payments: [{ ...f.payment, refunded: 1 }] }) },
      { name: "voided invoice with reversed payment", invoice: f => ({ ...f.invoice, status: "voided", payments: [{ ...f.payment, status: "reversed", captured: 0 }] }) },
      { name: "voided invoice with ambiguous multiple zero-charge voids", invoice: f => ({ ...f.invoice, status: "voided", payments: [
        { ...f.payment, status: "voided", captured: 0 }, { ...f.payment, id: randomUUID(), status: "voided", captured: 0 },
      ] }) },
      { name: "voided invoice with captured void payment", invoice: f => ({ ...f.invoice, status: "voided", payments: [{ ...f.payment, status: "voided", voided_at: "2026-10-13T00:00:00.000Z" }] }) },
    ];
    for (const variant of variants) await scenario(`direct ${variant.name}: sticky hold and stale replays`, async () => {
      const f = await fixture(), before = await financial(f), invoice = variant.invoice(f);
      for (let n = 0; n < 3; n++) await settleInvoice(f.purchase.id, invoice);
      await assertHeld(f, before);
      return { purchaseId: f.purchase.id, ...await staleReplay(f, before) };
    });
    await scenario("real callback paid hint fetches reversed provider invoice and cannot grant", async () => {
      const f = await fixture(), before = await financial(f);
      for (let n = 0; n < 3; n++) await callCallback(f, refunded(f));
      assert.ok(await db().paymentEvent.findFirst({ where: { purchaseId: f.purchase.id, source: "CALLBACK", processingResult: "REVIEW_REQUIRED" } }));
      return { purchaseId: f.purchase.id, ...await staleReplay(f, before) };
    });
    await scenario("POLL enters sticky hold from fresh reversal then stale paid observation", async () => {
      const f = await fixture(), before = await financial(f);
      for (let n = 0; n < 3; n++) await reconcilePurchase(f.purchase.id, provider(f, refunded(f)), "POLL");
      return { purchaseId: f.purchase.id, ...await staleReplay(f, before) };
    });
    await scenario("CRON reconciliation marks a pending reversal and later blocks stale payment", async () => {
      const f = await fixture(), before = await financial(f);
      async function batch(invoice: Invoice) {
        assert.equal(await db().purchase.count({ where: { id: { not: f.purchase.id }, status: "PENDING", nextReconcileAt: { lte: new Date() } } }), 0);
        await db().purchase.update({ where: { id: f.purchase.id }, data: { nextReconcileAt: new Date(0) } });
        try { const outcome = await reconcileBatch(provider(f, invoice)); assert.equal(outcome.checked, 1); assert.equal(outcome.failures, 0); assert.equal(outcome.updated, 0); return outcome; }
        finally { await db().purchase.update({ where: { id: f.purchase.id }, data: { nextReconcileAt: future } }); }
      }
      const first = await batch(refunded(f)), stale = await batch(f.invoice);
      assert.ok(await db().paymentEvent.findFirst({ where: { purchaseId: f.purchase.id, source: "CRON", processingResult: "REVIEW_REQUIRED" } }));
      return { purchaseId: f.purchase.id, first, stale, ...await staleReplay(f, before) };
    });
    for (const shape of ["no-payments", "one-zero-charge-void"] as const) await scenario(`prepayment invoice void ${shape} remains VOIDED without a review hold`, async () => {
      const f = await fixture();
      const payments = shape === "no-payments" ? undefined : [{ ...f.payment, status: "voided", captured: 0, voided_at: "2026-10-13T00:00:00.000Z" }];
      await settleInvoice(f.purchase.id, { ...f.invoice, status: "voided", payments });
      const saved = await financial(f);
      assert.equal(saved.purchase.status, "VOIDED"); assert.equal(saved.purchase.paidAt, null); assert.equal(saved.purchase.couponReserved, false);
      assert.deepEqual(saved.coupon, { usedCount: 0, reservedCount: 0 }); assert.equal(saved.wallet.balance, 0);
      assert.equal(saved.grant, null); assert.equal(saved.refund, null); assert.equal(saved.completions, 0);
      assert.equal(await db().paymentEvent.count({ where: { purchaseId: f.purchase.id, processingResult: "REVIEW_REQUIRED" } }), 0);
      for (let n = 0; n < 3; n++) await settleInvoice(f.purchase.id, f.invoice);
      assert.deepEqual(await financial(f), saved); return { purchaseId: f.purchase.id, status: "VOIDED", noCredits: true };
    });
    await scenario("normal paid settlement across direct/callback/POLL/CRON grants exactly once", async () => {
      const f = await fixture();
      await settleInvoice(f.purchase.id, f.invoice);
      for (let n = 0; n < 3; n++) {
        await callCallback(f, f.invoice); await reconcilePurchase(f.purchase.id, provider(f, f.invoice), "POLL");
        await reconcilePurchase(f.purchase.id, provider(f, f.invoice), "CRON"); await settleInvoice(f.purchase.id, f.invoice);
      }
      return { purchaseId: f.purchase.id, financial: await assertPaid(f) };
    });
    for (let iteration = 0; iteration < 3; iteration++) {
      await scenario(`native reversal-first then stale paid contender ${iteration + 1}`, async () => {
        const f = await fixture(), before = await financial(f);
        const raced = await race("Purchase", f.purchase.id, [() => settleInvoice(f.purchase.id, refunded(f)), () => settleInvoice(f.purchase.id, f.invoice)]);
        assert.ok(raced.outcomes.every(outcome => outcome.status === "fulfilled"));
        return { purchaseId: f.purchase.id, gatePid: raced.gatePid, blockedBackendPids: raced.blockedBackendPids, ...await staleReplay(f, before) };
      });
      await scenario(`native paid-first then stale-PENDING reversal observer ${iteration + 1}`, async () => {
        const f = await fixture(); let purchaseStatusAtProviderFetch: string | undefined;
        const observed = { ...provider(f, refunded(f)), async fetchInvoice(id: string) {
          assert.equal(id, f.invoice.id); purchaseStatusAtProviderFetch = (await db().purchase.findUniqueOrThrow({ where: { id: f.purchase.id } })).status;
          return refunded(f);
        } };
        const raced = await race("Purchase", f.purchase.id, [() => settleInvoice(f.purchase.id, f.invoice), () => reconcilePurchase(f.purchase.id, observed, "POLL")]);
        assert.equal(purchaseStatusAtProviderFetch, "PENDING", "The reversal observer must actually see a stale pre-settlement status");
        assert.ok(raced.outcomes.every(outcome => outcome.status === "fulfilled"));
        const saved = await assertCompensated(f);
        for (let n = 0; n < 3; n++) { await reconcilePurchase(f.purchase.id, provider(f, refunded(f))); await callCallback(f, refunded(f)); await settleInvoice(f.purchase.id, f.invoice); }
        assert.deepEqual(await financial(f), saved);
        return { purchaseId: f.purchase.id, gatePid: raced.gatePid, blockedBackendPids: raced.blockedBackendPids, purchaseStatusAtProviderFetch, financial: saved };
      });
    }
    for (const first of ["START", "REFUND"] as const) await scenario(`actual Board START/refund native wallet contention ${first} first`, async () => {
      const f = await fixture(); await settleInvoice(f.purchase.id, f.invoice);
      const categories = await eligibleBoardCategories(); assert.ok(categories.length >= 6, "Real START acceptance requires seeded Board content");
      const game = await createBoardSession(f.user.id, { categoryIds: categories.slice(0, 6).map(category => category.id), teamNames: ["ألف", "باء"], timerSeconds: 30 });
      const key = randomUUID(), start = () => applyBoardCommand(f.user.id, game.id, key, game.version, { type: "START" });
      const refund = () => reconcilePurchase(f.purchase.id, provider(f, refunded(f)), "POLL");
      const raced = await race("CreditWallet", f.user.id, first === "START" ? [start, refund] : [refund, start]);
      const startOutcome = raced.outcomes[first === "START" ? 0 : 1], refundOutcome = raced.outcomes[first === "START" ? 1 : 0];
      assert.equal(refundOutcome.status, "fulfilled");
      const started = startOutcome.status === "fulfilled"; assert.equal(started, first === "START");
      if (!started) assert.equal((startOutcome as PromiseRejectedResult).reason.status, 402);
      const savedGame = await db().gameSession.findUniqueOrThrow({ where: { id: game.id } });
      assert.equal(savedGame.status, started ? "IN_PROGRESS" : "LOBBY"); assert.equal(savedGame.stateVersion, game.version + (started ? 1 : 0));
      assert.equal(await db().gameCommand.count({ where: { sessionId: game.id } }), started ? 1 : 0);
      assert.equal(await db().gameCredit.count({ where: { idempotencyKey: `game-start:${game.id}` } }), started ? 1 : 0);
      if (started) { await start(); assert.equal(await db().gameCredit.count({ where: { idempotencyKey: `game-start:${game.id}` } }), 1); }
      return { purchaseId: f.purchase.id, gatePid: raced.gatePid, blockedBackendPids: raced.blockedBackendPids, started,
        financial: await assertCompensated(f, started ? 2 : 3, started ? 1 : 0) };
    });
    report.status = "PASS";
  } catch (error) { report.failure = error instanceof Error ? error.message : "Native reversal validation failed"; throw error; }
  finally {
    globalThis.fetch = originalFetch;
    try {
      await writeFile(output, JSON.stringify({ ...report, passed: results.filter(result => result.status === "passed").length, syntheticHttpRequests: fetches.length }, null, 2), { flag: "wx", mode: 0o600 });
    } finally {
      try { await db().$disconnect(); } finally { await pool.end(); }
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
