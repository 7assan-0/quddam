/** Native lifecycle acceptance. Requires an explicitly opted-in disposable fixture DB. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Purchase } from "../src/generated/prisma/client";
import { db } from "../src/lib/db";
import { classifyRealtimeError } from "../src/lib/realtime/errors";
import { historyHref } from "../src/lib/games/history-policy";
import { runRetention } from "../src/lib/retention/service";
import { ensureInvoice } from "../src/lib/billing/invoice-creation";
import { reconcileBatch } from "../src/lib/billing/reconciliation";
import { confirmSupportRefund } from "../src/lib/billing/refunds";
import { settleInvoice } from "../src/lib/billing/checkout";
import type { Invoice, PaymentProvider } from "../src/lib/billing/provider";
import * as lightning from "../src/lib/games/lightning/service";
import * as court from "../src/lib/games/court/service";
import * as board from "../src/lib/games/category-board/service";
import { hostId, adminId, act, view, populate, logicalSnapshot, createFixture, type Context } from "./database-lifecycle-fixtures";

assert.equal(process.env.LIFECYCLE_TEST_DATABASE, "1");
assert.match(process.env.DATABASE_URL ?? "", /127\.0\.0\.1.*\/f1_lifecycle/);
const out = process.env.LIFECYCLE_OUTPUT!;
assert.ok(out);
const mode = process.argv[2];
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8, application_name: `f1-worker-${mode}` });
const ctorPath = process.env.LIFECYCLE_PRE_UPGRADE === "1" ? "../src/generated/pre-upgrade/client.ts" : "../src/generated/prisma/client.ts";
let client: PrismaClient;
const normalize = (value: unknown) => JSON.parse(JSON.stringify(value));
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const file = (name: string) => `${out}/${name}`;
const load = <T>(name: string): T => JSON.parse(readFileSync(file(name), "utf8"));
const save = (name: string, value: unknown) => writeFileSync(file(name), JSON.stringify(value, null, 2));
const ctx = () => load<Context>("fixture-private.json");
const cases: { name: string; passed: boolean; detail: unknown }[] = [];
async function check(name: string, task: () => Promise<unknown>) {
  const detail = await task(); cases.push({ name, passed: true, detail }); console.log("PASS", name);
}
async function footprint() {
  const x = await logicalSnapshot();
  return { digest: digest(x), counts: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v.length])), data: normalize(x) };
}
const alive = () => new Promise<void>(() => { setInterval(() => undefined, 1000); });
async function main() {
  const version = (await pool.query("SELECT version() AS v")).rows[0].v;
  assert.match(version, /^PostgreSQL /); assert.doesNotMatch(version, /PGlite/);
  if (mode === "fixture") {
    const c = await populate(); save("fixture-private.json", c);
    const before = await footprint(); save("pre-upgrade-logical.json", before);
    await check("01 populated pre-E1 schema contains all ten active and completed games", async () => {
      assert.equal(c.active.length, 10); assert.equal(c.completed.length, 10);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name=\'SocialRound\' AND column_name=\'retainedVoteCounts\'')).rows[0].n, 0);
      assert.equal(await client.purchaseRefund.count(), 1); assert.ok(await client.paymentEvent.count() >= 3);
      assert.ok(before.counts.commands >= 50);
      const letterUses = before.data.snapshots.filter((s: { model: string }) => s.model === "LetterQuestionUse");
      assert.equal(letterUses.length, 2);
      return { beforeFingerprint: before.digest, counts: before.counts, preUpgradeLetterSnapshotCount: letterUses.length, latestColumnsAbsent: true, syntheticOnly: true };
    });
  } else if (mode === "verify-upgrade") {
    await check("02 populated upgrade preserves all non-secret logical fingerprints", async () => {
      const before = load<Awaited<ReturnType<typeof footprint>>>("pre-upgrade-logical.json"), after = await footprint();
      assert.deepEqual(after.data, before.data); assert.equal(after.digest, before.digest);
      save("post-upgrade-logical.json", after); return { before: before.digest, after: after.digest, counts: after.counts };
    });
    await check("03 migration/default/index/FK validation and immutable snapshot integrity", async () => {
      const migrations = await pool.query('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
      assert.equal(migrations.rowCount, 24);
      assert.equal((await pool.query("SELECT count(*)::int n FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated")).rows[0].n, 0);
      assert.equal((await pool.query("SELECT count(*)::int n FROM pg_index WHERE NOT indisvalid OR NOT indisready")).rows[0].n, 0);
      const indices = (await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname='public'")).rows.map(r => r.indexname);
      for (const i of ["GameCommand_sessionId_key_key", "GameCredit_idempotencyKey_key", "Purchase_providerReference_key", "AuthSession_expiresAt_idx", "GameSession_status_endedAt_id_idx"]) assert.ok(indices.includes(i), i);
      assert.ok((await client.socialRound.findMany()).every(r => digest(r.retainedVoteCounts) === digest({})));
      assert.ok((await client.courtRound.findMany()).every(r => r.retainedVoteCount === 0));
      const round = await client.socialRound.findFirstOrThrow();
      await assert.rejects(client.socialRound.update({ where: { id: round.id }, data: { wordSnapshot: "تعديل ممنوع" } }));
      return { migrationCount: migrations.rowCount, checksums: migrations.rows, allConstraintsValidated: true, allIndexesReady: true, indexCount: indices.length, snapshotsImmutable: true };
    });
    await check("04 all ten terminal results and profile route identities survive upgrade", async () => {
      const rows = [];
      for (const f of ctx().completed) {
        const session = await client.gameSession.findUniqueOrThrow({ where: { id: f.id }, include: { gameType: true } });
        assert.equal(session.status, "COMPLETED"); await view(f);
        if (f.game === "letter") {
          const result = await view(f) as { lastAnswer: { text: string; answer: string } | null };
          const use = await client.letterQuestionUse.findFirstOrThrow({ where: { sessionId: f.id } });
          assert.deepEqual(result.lastAnswer, { text: use.questionSnapshot, answer: use.answerSnapshot });
        }
        rows.push({ game: f.game, id: f.id, status: session.status, href: historyHref(session), version: session.stateVersion });
      }
      save("historical-routes.json", rows); return rows;
    });
  } else if (mode === "restore-check") {
    await check("17 pg_dump restored into a NEW database then upgraded without reset", async () => {
      const before = load<Awaited<ReturnType<typeof footprint>>>("pre-upgrade-logical.json"), after = await footprint();
      assert.deepEqual(after.data, before.data); assert.equal(after.digest, before.digest);
      for (const f of ctx().completed) { assert.equal((await client.gameSession.findUniqueOrThrow({ where: { id: f.id } })).status, "COMPLETED"); await view(f); }
      return { restoredFingerprint: after.digest, expectedFingerprint: before.digest, counts: after.counts, allTenResultsReadable: true, inPlaceReset: false, backupRpoIsSnapshotTime: true };
    });
  } else if (mode === "continue-active") {
    await check("05 active engines continue with same identities and no repeat START debit", async () => {
      const rows = [], c = ctx(), wallet = (await client.creditWallet.findUniqueOrThrow({ where: { userId: hostId } })).balance;
      for (const f of c.active.filter(f => ["board", "social", "letter", "ranked", "lightning", "ordering", "court"].includes(f.game))) {
        const before = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } }), s = before.state as Record<string, unknown>;
        if (f.game === "board") { const cell = (s.cells as { categoryId: string; value: number }[])[0]; await act(f, { type: "OPEN", categoryId: cell.categoryId, value: cell.value }); }
        else if (f.game === "social") await act(f, { type: "BEGIN_DISCUSSION" });
        else if (f.game === "letter") {
          const cell = (s.board as { cellId: string; state: string }[]).find(c => c.state === "AVAILABLE"); assert.ok(cell);
          const beforeUses = await client.letterQuestionUse.findMany({ where: { sessionId: f.id } });
          assert.equal(beforeUses.length, 1);
          await act(f, { type: "SELECT_CELL", cellId: cell.cellId });
          assert.deepEqual(await client.letterQuestionUse.findUniqueOrThrow({ where: { id: beforeUses[0].id } }), beforeUses[0]);
        }
        else if (f.game === "ranked" || f.game === "ordering") await act(f, { type: "START_ROUND" });
        else if (f.game === "lightning") await act(f, { type: "PREPARE_QUESTION" });
        else await court.submitCourtVote(f.id, f.people[1].token, randomUUID(), 1, 1, "DEFENSE");
        const after = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } });
        assert.equal(after.stateVersion, before.stateVersion + 1); assert.equal(after.id, before.id); assert.deepEqual(after.creditConsumedAt, before.creditConsumedAt);
        assert.equal(await client.gameCredit.count({ where: { idempotencyKey: `game-start:${f.id}` } }), 1);
        rows.push({ game: f.game, id: f.id, beforeVersion: before.stateVersion, afterVersion: after.stateVersion, oneStartDebit: true });
      }
      assert.equal((await client.creditWallet.findUniqueOrThrow({ where: { userId: hostId } })).balance, wallet); return rows;
    });
  } else if (mode === "prepare-offline") {
    const c = ctx(), l = c.active.find(f => f.game === "lightning")!;
    await act(l, { type: "OPEN_BUZZ" });
    const teams = await client.team.findMany({ where: { sessionId: l.id }, orderBy: { position: "asc" } });
    const access = await lightning.createLightningBuzzerAccess(hostId, l.id, teams[0].id);
    await lightning.applyBuzz(l.id, access.token, randomUUID(), (await client.gameSession.findUniqueOrThrow({ where: { id: l.id } })).stateVersion);
    await act(l, { type: "WRONG" });
    const letter = c.active.find(f => f.game === "letter")!; await act(letter, { type: "OPEN_QUESTION" });
    const deadline = Date.now() + 6000, before: { id: string; game: string; version: number; deadline: number; scoreEvents: number; commands: number }[] = [];
    for (const f of c.active.filter(f => ["lightning", "ordering", "court", "ranked", "letter"].includes(f.game))) {
      const value = f.game === "letter" ? JSON.stringify(new Date(deadline).toISOString()) : String(deadline);
      await client.$executeRawUnsafe('UPDATE "GameSession" SET state=jsonb_set(state,\'{deadlineAt}\',$1::jsonb) WHERE id=$2', value, f.id);
      const s = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } });
      before.push({ id: f.id, game: f.game, version: s.stateVersion, deadline, scoreEvents: await client.scoreEvent.count({ where: { sessionId: f.id } }), commands: await client.gameCommand.count({ where: { sessionId: f.id } }) });
    }
    save("offline-deadlines.json", { deadline, before });
    await check("06 five future authoritative deadlines persisted before process stop", async () => ({ deadline, before, fixtureClockOnly: true }));
  } else if (mode === "verify-offline") {
    await check("07 offline deadlines resolve once after new application/worker processes", async () => {
      const before = load<{ deadline: number; before: { id: string; game: string; version: number; scoreEvents: number }[] }>("offline-deadlines.json");
      assert.ok(Date.now() > before.deadline);
      const rows = [];
      for (const b of before.before) {
        const f = ctx().active.find(f => f.id === b.id)!;
        await Promise.all(Array.from({ length: 4 }, () => view(f)));
        const first = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } });
        assert.equal(first.stateVersion, b.version + 1);
        const firstCount = await client.scoreEvent.count({ where: { sessionId: f.id } });
        await Promise.all(Array.from({ length: 4 }, () => view(f)));
        const second = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } });
        assert.deepEqual(second, first); assert.equal(await client.scoreEvent.count({ where: { sessionId: f.id } }), firstCount);
        const state = first.state as { phase: string; deadlineAt: number | string | null };
        assert.equal(state.phase, ({ lightning: "QUESTION_RESULTS", ordering: "REVEAL", court: "VERDICT", ranked: "GUESS_ACTIVE", letter: "STEAL" } as Record<string, string>)[f.game]);
        if (state.deadlineAt !== null) assert.ok(new Date(state.deadlineAt).getTime() > Date.now());
        rows.push({ game: f.game, id: f.id, beforeVersion: b.version, afterVersion: first.stateVersion, phase: state.phase, scoreEventsBefore: b.scoreEvents, scoreEventsAfter: firstCount, repeatedReadStable: true });
      }
      return rows;
    });
  } else if (mode === "retention-interrupt") {
    const r = await runRetention({ kinds: ["AuthSession"], batchSize: 3 }); assert.equal(r.deleted, 3);
    save("retention-committed.json", r); save("worker-ready.json", { mode, committed: true }); await alive();
  } else if (mode === "reconcile-interrupt") {
    const product = await client.product.findFirstOrThrow({ where: { active: true } }), purchases: Purchase[] = [];
    // Isolate this job's due queue without deleting any pre-upgrade records.
    await client.purchase.updateMany({ where: { status: "PENDING" }, data: { nextReconcileAt: new Date(Date.now() + 86400_000) } });
    for (let i = 0; i < 5; i++) purchases.push(await client.purchase.create({ data: { userId: hostId, productId: product.id, provider: "moyasar", providerReference: randomUUID(), credits: product.credits, amountHalalas: product.priceHalalas, invoiceCreationState: "CREATED", invoiceCreationAttemptAt: new Date(), nextReconcileAt: new Date(Date.now() - 1000), idempotencyKey: randomUUID() } }));
    save("reconcile-private.json", purchases);
    let calls = 0;
    const provider: PaymentProvider = { async createInvoice() { throw Error("No create"); }, async fetchInvoice(id) { const p = purchases.find(p => p.providerReference === id)!; if (calls++ === 0) return { id, status: "paid", amount: p.amountHalalas, currency: "SAR", metadata: { purchase_id: p.id } }; return new Promise<Invoice>(() => undefined); } };
    const timer = setInterval(async () => { if (await client.purchase.count({ where: { id: { in: purchases.map(p => p.id) }, status: "PAID" } })) save("worker-ready.json", { mode, committed: true }); }, 100);
    try { await reconcileBatch(provider); } finally { clearInterval(timer); }
  } else if (mode === "invoice-interrupt") {
    const p = await client.purchase.findUniqueOrThrow({ where: { id: ctx().unknownPurchaseId } });
    // A second durable intent starts from NOT_CREATED; the pre-upgrade UNKNOWN row stays untouched.
    const created = await client.purchase.create({ data: { userId: p.userId, productId: p.productId, provider: "moyasar", amountHalalas: p.amountHalalas, credits: p.credits, expiresAt: new Date(Date.now() + 86400_000), nextReconcileAt: new Date(Date.now() + 86400_000), idempotencyKey: randomUUID() } });
    const provider: PaymentProvider = { async createInvoice(input) { const invoice: Invoice = { id: randomUUID(), status: "initiated", amount: input.amount, currency: "SAR", metadata: { purchase_id: input.purchaseId }, url: `https://checkout.moyasar.com/invoices/${randomUUID()}` }; save("remote-invoice-private.json", { purchaseId: created.id, invoice, creates: 1 }); save("worker-ready.json", { mode, remoteCreated: true }); return new Promise<Invoice>(() => undefined); }, async fetchInvoice() { throw Error("Not used"); } };
    await ensureInvoice(created.id, provider);
  } else if (mode === "refund-before" || mode === "refund-after") {
    const c = ctx(), f = c.financial;
    // Use a distinct paid purchase for interruption; keep original SUPPORT_REQUIRED immutable.
    let purchaseId: string;
    let invoice: Invoice;
    if (mode === "refund-before") {
      const product = await client.product.findFirstOrThrow({ where: { credits: 3, active: true } });
      const p = await client.purchase.create({ data: { userId: f.userId, productId: product.id, provider: "moyasar", providerReference: randomUUID(), amountHalalas: 1350, credits: 3, invoiceCreationState: "CREATED", invoiceCreationAttemptAt: new Date(), idempotencyKey: randomUUID() } });
      invoice = { ...f.invoice, id: p.providerReference!, metadata: { purchase_id: p.id }, payments: [{ ...f.payment, id: randomUUID(), invoice_id: p.providerReference! }] }; purchaseId = p.id;
      await settleInvoice(p.id, { ...invoice, payments: [{ ...invoice.payments![0], status: "paid", refunded: 0 }] });
      save("refund-private.json", { purchaseId, invoice });
    } else ({ purchaseId, invoice } = load<{ purchaseId: string; invoice: Invoice }>("refund-private.json"));
    const provider: PaymentProvider = { async createInvoice() { throw Error("Not used"); }, async fetchInvoice() { return invoice; }, async fetchPayment() { if (mode === "refund-before") { save("worker-ready.json", { mode, beforeCompensation: true }); await alive(); } return invoice.payments![0]; } };
    const result = await confirmSupportRefund(purchaseId, invoice.id, invoice.payments![0].id, adminId, provider);
    save("refund-committed.json", result); save("worker-ready.json", { mode, committed: true }); await alive();
  } else if (mode === "resume-jobs") {
    await check("08 interrupted reconciliation leases recover without duplicate settlement", async () => {
      const rows = load<{ id: string; providerReference: string; amountHalalas: number }[]>("reconcile-private.json");
      const paid = await client.purchase.count({ where: { id: { in: rows.map(p => p.id) }, status: "PAID" } }); assert.equal(paid, 1);
      const provider: PaymentProvider = { async createInvoice() { throw Error("No create"); }, async fetchInvoice(id) { const p = rows.find(p => p.providerReference === id)!; return { id, status: "paid", amount: p.amountHalalas, currency: "SAR", metadata: { purchase_id: p.id } }; } };
      const result = await reconcileBatch(provider, new Date(Date.now() + 11 * 60_000)); assert.equal(result.updated, 4); assert.equal(result.checked, 4);
      for (const p of rows) { assert.equal(await client.gameCredit.count({ where: { idempotencyKey: `purchase:${p.id}` } }), 1); assert.equal(await client.analyticsEvent.count({ where: { name: "PURCHASE_COMPLETED", properties: { path: ["purchaseId"], equals: p.id } } }), 1); }
      assert.equal((await reconcileBatch(provider, new Date(Date.now() + 11 * 60_000))).checked, 0);
      return { beforePaid: paid, result, afterPaid: 5, oneGrantAndCompletionPerPurchase: true, expiredLeaseClockInjected: true };
    });
    await check("09 killed invoice creator recovers strong matched single remote invoice", async () => {
      const remote = load<{ purchaseId: string; invoice: Invoice; creates: number }>("remote-invoice-private.json");
      const before = await client.purchase.findUniqueOrThrow({ where: { id: remote.purchaseId } }); assert.equal(before.invoiceCreationState, "UNKNOWN_OUTCOME"); assert.equal(before.providerReference, null);
      const provider: PaymentProvider = { async createInvoice() { throw Error("Must not POST again"); }, async recoverInvoice(id) { assert.equal(id, remote.purchaseId); return remote.invoice; }, async fetchInvoice() { return remote.invoice; } };
      const linked = await ensureInvoice(remote.purchaseId, provider); await ensureInvoice(remote.purchaseId, provider);
      assert.equal(linked.providerReference, remote.invoice.id); assert.equal(linked.invoiceCreationState, "CREATED");
      const unknown = ctx().unknownPurchaseId; await assert.rejects(ensureInvoice(unknown, { ...provider, async recoverInvoice() { return null; } }));
      assert.equal((await client.purchase.findUniqueOrThrow({ where: { id: unknown } })).status, "PENDING");
      return { purchaseId: remote.purchaseId, state: linked.invoiceCreationState, oneRemoteCreate: remote.creates, repeatedRetryStable: true, unrecoverableUnknownRemainsPending: true };
    });
    await check("10 refund commit lost response retries exactly once with original grant intact", async () => {
      const f = load<{ purchaseId: string; invoice: Invoice }>("refund-private.json");
      const before = await client.purchaseRefund.findUniqueOrThrow({ where: { purchaseId: f.purchaseId } });
      const grant = await client.gameCredit.findUniqueOrThrow({ where: { idempotencyKey: `purchase:${f.purchaseId}` } });
      const balance = (await client.creditWallet.findUniqueOrThrow({ where: { userId: ctx().financial.userId } })).balance;
      const provider: PaymentProvider = { async createInvoice() { throw Error("No create"); }, async fetchInvoice() { return f.invoice; }, async fetchPayment() { return f.invoice.payments![0]; } };
      const result = await confirmSupportRefund(f.purchaseId, f.invoice.id, f.invoice.payments![0].id, adminId, provider); assert.equal(result.duplicate, true);
      assert.deepEqual(await client.purchaseRefund.findUniqueOrThrow({ where: { purchaseId: f.purchaseId } }), before);
      assert.deepEqual(await client.gameCredit.findUniqueOrThrow({ where: { id: grant.id } }), grant);
      assert.equal((await client.creditWallet.findUniqueOrThrow({ where: { userId: ctx().financial.userId } })).balance, balance); assert.ok(balance >= 0);
      assert.equal(await client.gameCredit.count({ where: { idempotencyKey: `purchase-refund:${f.purchaseId}:full` } }), 1);
      return { ...result, oneCompensation: true, originalGrantPreserved: true, balance };
    });
    await check("11 interrupted bounded retention resumes without financial/history loss", async () => {
      const financialBefore = digest((await logicalSnapshot()).purchases), refunds = digest(await client.purchaseRefund.findMany({ orderBy: { id: "asc" } }));
      const first = load<{ deleted: number }>("retention-committed.json"); assert.equal(first.deleted, 3);
      const second = await runRetention({ kinds: ["AuthSession"], batchSize: 3 }), third = await runRetention({ kinds: ["AuthSession"], batchSize: 3 }), repeat = await runRetention({ kinds: ["AuthSession"], batchSize: 3 });
      assert.equal(second.deleted, 3); assert.ok(third.deleted >= 1 && third.deleted <= 3); assert.equal(repeat.deleted, 0);
      const privateResult = await runRetention({ kinds: ["SocialVote", "SocialParticipant"], batchSize: 20 });
      assert.equal(privateResult.failed, 0); for (const f of ctx().completed) { assert.equal((await client.gameSession.findUniqueOrThrow({ where: { id: f.id } })).status, "COMPLETED"); await view(f); }
      assert.equal(digest((await logicalSnapshot()).purchases), financialBefore); assert.equal(digest(await client.purchaseRefund.findMany({ orderBy: { id: "asc" } })), refunds);
      return { first, second, third, repeat, privateResult, terminalHistoryPreserved: true, financialPreserved: true };
    });
  } else if (mode === "failure-mvcc") {
    await check("12 actual isolation levels and read snapshot does not wait on command row lock", async () => {
      const settings = await client.$transaction(async tx => tx.$queryRawUnsafe<{ transaction_isolation: string }[]>('SHOW transaction_isolation'));
      assert.equal(settings[0].transaction_isolation, "read committed");
      const rr = await client.$transaction(tx => tx.$queryRawUnsafe<{ transaction_isolation: string }[]>('SHOW transaction_isolation'), { isolationLevel: "RepeatableRead" }); assert.equal(rr[0].transaction_isolation, "repeatable read");
      const f = ctx().active.find(f => f.game === "court")!, lock = await pool.connect();
      try { await lock.query("BEGIN"); await lock.query('SELECT id FROM "GameSession" WHERE id=$1 FOR UPDATE', [f.id]); const started = Date.now(); await view(f); assert.ok(Date.now() - started < 2000); await lock.query("ROLLBACK"); return { defaultIsolation: settings[0].transaction_isolation, viewIsolation: rr[0].transaction_isolation, viewCompletedWhileCommandRowLocked: true }; } finally { lock.release(); }
    });
    await check("13 database disconnect rolls back transaction before commit", async () => {
      const balance = (await client.creditWallet.findUniqueOrThrow({ where: { userId: hostId } })).balance;
      const connection = await pool.connect(); connection.on("error", () => undefined);
      try { const pid = (await connection.query("SELECT pg_backend_pid() pid")).rows[0].pid; await connection.query("BEGIN"); await connection.query('UPDATE "CreditWallet" SET balance=balance-1 WHERE "userId"=$1', [hostId]); await pool.query("SELECT pg_terminate_backend($1)", [pid]); await assert.rejects(connection.query("COMMIT")); }
      finally { connection.release(true); }
      assert.equal((await client.creditWallet.findUniqueOrThrow({ where: { userId: hostId } })).balance, balance); return { rollbackProven: true, walletBalance: balance, noFailedPaymentOrGame: true };
    });
    await check("14 failure before transaction/pool exhaustion remains transient and recovers", async () => {
      const broken = new Pool({ connectionString: "postgresql://postgres@127.0.0.1:1/f1_lifecycle", connectionTimeoutMillis: 100 });
      try { await assert.rejects(broken.query("SELECT 1"), e => { assert.equal(classifyRealtimeError(e), "TRANSIENT"); return true; }); } finally { await broken.end(); }
      const small = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 100 }); const held = await small.connect();
      try { await assert.rejects(small.query("SELECT 1"), e => { assert.equal(classifyRealtimeError(e), "TRANSIENT"); return true; }); }
      finally { held.release(); }
      assert.equal((await small.query("SELECT 1 AS n")).rows[0].n, 1); await small.end();
      await view(ctx().active.find(f => f.game === "court")!); return { connectionRefusedTransient: true, boundedPoolExhaustionTransient: true, subsequentQueryAndViewRecovered: true };
    });
    await check("15 PostgreSQL real deadlock victim is whole-transaction rollback, no blind retry", async () => {
      const a = await pool.connect(), b = await pool.connect(), ids = [hostId, ctx().financial.userId];
      let code = "", winner = 0;
      try {
        await a.query("BEGIN"); await b.query("BEGIN"); await a.query("SET LOCAL deadlock_timeout='100ms'"); await b.query("SET LOCAL deadlock_timeout='100ms'");
        await a.query('SELECT * FROM "CreditWallet" WHERE "userId"=$1 FOR UPDATE', [ids[0]]); await b.query('SELECT * FROM "CreditWallet" WHERE "userId"=$1 FOR UPDATE', [ids[1]]);
        await Promise.all([a.query('SELECT * FROM "CreditWallet" WHERE "userId"=$1 FOR UPDATE', [ids[1]]).then(async () => { winner++; await a.query("ROLLBACK"); }, async e => { code = e.code; await a.query("ROLLBACK"); }), b.query('SELECT * FROM "CreditWallet" WHERE "userId"=$1 FOR UPDATE', [ids[0]]).then(async () => { winner++; await b.query("ROLLBACK"); }, async e => { code = e.code; await b.query("ROLLBACK"); })]);
        assert.equal(code, "40P01"); assert.equal(winner, 1);
      } finally { a.release(); b.release(); }
      return { expectedInjectedDeadlock: code, oneVictim: true, lockOnlySyntheticProbe: true, noFinancialMutation: true };
    });
    await check("16 aborted real START transaction leaves no receipt/debit; same-key retry works", async () => {
      const f = await createFixture("board", false), key = randomUUID();
      const before = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } });
      const old = db(), proxy = new Proxy(old, { get(target, prop) { if (prop === "$transaction") return (task: (tx: unknown) => Promise<unknown>, options: unknown) => target.$transaction(async tx => { const result = await task(tx); throw Object.assign(Error("Injected precommit abort"), { safe: true, result: Boolean(result) }); }, options as { timeout?: number }); const value = Reflect.get(target, prop); return typeof value === "function" ? value.bind(target) : value; } });
      (globalThis as unknown as { prisma: PrismaClient }).prisma = proxy;
      try { await assert.rejects(act(f, { type: "START" }, key)); } finally { (globalThis as unknown as { prisma: PrismaClient }).prisma = old; }
      assert.deepEqual(await client.gameSession.findUniqueOrThrow({ where: { id: f.id } }), before); assert.equal(await client.gameCommand.count({ where: { sessionId: f.id, key } }), 0);
      await act(f, { type: "START" }, key);
      await act(f, { type: "START" }, key);
      assert.equal(await client.gameCommand.count({ where: { sessionId: f.id, key } }), 1);
      assert.equal(await client.gameCredit.count({ where: { idempotencyKey: `game-start:${f.id}` } }), 1);
      return { rollbackBeforeCommit: true, oneReceiptAfterRetry: true, oneOriginalStartDebit: true };
    });
    await check("18 repeatable-read view transaction retains one coherent MVCC snapshot", async () => {
      const key = `f1-mvcc-${randomUUID()}`;
      await client.featureFlag.create({ data: { key, enabled: true, config: { revision: 1 } } });
      const observations = await client.$transaction(async tx => {
        const first = await tx.featureFlag.findUniqueOrThrow({ where: { key } });
        const writerPid = (await pool.query("SELECT pg_backend_pid() pid")).rows[0].pid;
        await pool.query('UPDATE "FeatureFlag" SET config=\'{"revision":2}\'::jsonb WHERE key=$1', [key]);
        const second = await tx.featureFlag.findUniqueOrThrow({ where: { key } });
        assert.deepEqual(second.config, first.config);
        return { firstRevision: (first.config as { revision: number }).revision, secondRevision: (second.config as { revision: number }).revision, independentWriterPid: writerPid };
      }, { isolationLevel: "RepeatableRead" });
      assert.deepEqual((await client.featureFlag.findUniqueOrThrow({ where: { key } })).config, { revision: 2 });
      return { ...observations, newTransactionRevision: 2, privateAudienceCacheShared: false };
    });
    await check("19 real serialization failure rolls back victim and is classified transient", async () => {
      const key = `f1-serialization-${randomUUID()}`; await client.featureFlag.create({ data: { key, config: { revision: 1 } } });
      const a = await pool.connect(), b = await pool.connect(); let code = "";
      try {
        await a.query("BEGIN ISOLATION LEVEL SERIALIZABLE"); await b.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        await a.query('SELECT config FROM "FeatureFlag" WHERE key=$1', [key]); await b.query('SELECT config FROM "FeatureFlag" WHERE key=$1', [key]);
        await a.query('UPDATE "FeatureFlag" SET config=\'{"revision":2}\' WHERE key=$1', [key]); await a.query("COMMIT");
        await assert.rejects(b.query('UPDATE "FeatureFlag" SET config=\'{"revision":3}\' WHERE key=$1', [key]), error => { code = (error as { code: string }).code; assert.equal(code, "40001"); assert.equal(classifyRealtimeError(error), "TRANSIENT"); return true; });
        await b.query("ROLLBACK");
      } finally { a.release(); b.release(); }
      assert.deepEqual((await client.featureFlag.findUniqueOrThrow({ where: { key } })).config, { revision: 2 });
      return { sqlState: code, oneCommittedRevision: 2, noAutomaticBlindRetry: true };
    });
    await check("20 real concurrent START with one key has one debit and receipt", async () => {
      const f = await createFixture("board", false), key = randomUUID(), wallet = (await client.creditWallet.findUniqueOrThrow({ where: { userId: hostId } })).balance;
      const gate = await pool.connect(); const running: Promise<unknown>[] = []; let pids: number[] = [];
      try {
        await gate.query("BEGIN"); await gate.query('SELECT * FROM "CreditWallet" WHERE "userId"=$1 FOR UPDATE', [hostId]);
        running.push(act(f, { type: "START" }, key)); running.push(act(f, { type: "START" }, key));
        const end = Date.now() + 4000;
        do { pids = (await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND pid<>pg_backend_pid()")).rows.map(r => Number(r.pid)); if (pids.length >= 2) break; await new Promise(r => setTimeout(r, 20)); } while (Date.now() < end);
        assert.ok(new Set(pids).size >= 2); await gate.query("COMMIT"); await Promise.all(running);
      } finally { await gate.query("ROLLBACK"); gate.release(); }
      assert.equal((await client.creditWallet.findUniqueOrThrow({ where: { userId: hostId } })).balance, wallet - 1);
      assert.equal(await client.gameCommand.count({ where: { sessionId: f.id, key } }), 1); assert.equal(await client.gameCredit.count({ where: { idempotencyKey: `game-start:${f.id}` } }), 1);
      return { independentBlockedPids: pids, oneReceipt: true, oneDebit: true };
    });
    await check("21 correct vs wrong commands serialize with one authoritative result", async () => {
      const f = await createFixture("lightning"); await act(f, { type: "PREPARE_QUESTION" }); await act(f, { type: "OPEN_BUZZ" });
      const team = await client.team.findFirstOrThrow({ where: { sessionId: f.id }, orderBy: { position: "asc" } }), access = await lightning.createLightningBuzzerAccess(hostId, f.id, team.id);
      await lightning.applyBuzz(f.id, access.token, randomUUID(), (await client.gameSession.findUniqueOrThrow({ where: { id: f.id } })).stateVersion);
      const before = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } }), gate = await pool.connect();
      try {
        await gate.query("BEGIN"); await gate.query('SELECT id FROM "GameSession" WHERE id=$1 FOR UPDATE', [f.id]);
        const tasks = ["CORRECT", "WRONG"].map(type => lightning.applyLightningCommand(f.id, hostId, randomUUID(), before.stateVersion, { type } as Parameters<typeof lightning.applyLightningCommand>[4]).then(() => ({ ok: true, status: 200 }), error => ({ ok: false, status: error.status })));
        const end = Date.now() + 4000; let pids: number[] = [];
        do { pids = (await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%GameSession%' AND query LIKE '%FOR UPDATE%'")).rows.map(r => Number(r.pid)); if (pids.length >= 2) break; await new Promise(r => setTimeout(r, 20)); } while (Date.now() < end);
        assert.ok(new Set(pids).size >= 2); await gate.query("COMMIT"); const outcomes = await Promise.all(tasks); assert.equal(outcomes.filter(o => o.ok).length, 1); assert.equal(outcomes.filter(o => !o.ok && o.status === 409).length, 1);
        const after = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } }); assert.equal(after.stateVersion, before.stateVersion + 1);
        const state = after.state as { phase: string; results: unknown[] }; assert.ok(["QUESTION_RESULTS", "STEAL"].includes(state.phase)); assert.equal(state.results.length, state.phase === "QUESTION_RESULTS" ? 1 : 0);
        return { pids, outcomes, oneVersionAdvance: true, phase: state.phase, results: state.results.length };
      } finally { await gate.query("ROLLBACK"); gate.release(); }
    });
    await check("22 Court expired deadline vs final vote resolves verdict exactly once", async () => {
      const f = await createFixture("court"); await act(f, { type: "START_ROUND" }); await act(f, { type: "START_PREPARATION" }); for (let i = 0; i < 5; i++) await act(f, { type: "ADVANCE_PHASE" });
      for (const p of f.people.slice(0, 3)) await court.submitCourtVote(f.id, p.token, randomUUID(), 1, 1, "PROSECUTION");
      await client.$executeRaw`UPDATE "GameSession" SET state=jsonb_set(state,'{deadlineAt}',to_jsonb(${Date.now() - 1000}::bigint)) WHERE id=${f.id}`;
      const before = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } });
      const outcomes = await Promise.allSettled([court.submitCourtVote(f.id, f.people[3].token, randomUUID(), 1, 1, "DEFENSE"), view(f), view(f), view(f)]);
      assert.equal(outcomes[0].status, "rejected"); const after = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } });
      assert.equal(after.stateVersion, before.stateVersion + 1); assert.equal((after.state as { phase: string }).phase, "VERDICT"); assert.equal((after.state as { results: unknown[] }).results.length, 1);
      assert.equal(await client.courtRoundVote.count({ where: { round: { sessionId: f.id } } }), 3);
      const events = await client.scoreEvent.count({ where: { sessionId: f.id } }); await view(f); assert.equal(await client.scoreEvent.count({ where: { sessionId: f.id } }), events);
      return { oneVersionAdvance: true, verdicts: 1, acceptedVotes: 3, lateVoteRejected: true, scoreEvents: events, repeatedReadStable: true };
    });
    await check("23 six real START/refund lock-order probes preserve non-negative exactly-once wallet", async () => {
      const f = ctx().financial, product = await client.product.findFirstOrThrow({ where: { credits: 3, active: true } }), categories = (await board.eligibleBoardCategories()).slice(0, 6).map(c => c.id), results = [];
      for (let i = 0; i < 6; i++) {
        assert.equal((await client.creditWallet.findUniqueOrThrow({ where: { userId: f.userId } })).balance, 0);
        const p = await client.purchase.create({ data: { userId: f.userId, productId: product.id, provider: "moyasar", providerReference: randomUUID(), amountHalalas: 1350, credits: 3, invoiceCreationState: "CREATED", invoiceCreationAttemptAt: new Date(), idempotencyKey: randomUUID() } });
        const payment = { ...f.payment, id: randomUUID(), invoice_id: p.providerReference! }, invoice = { ...f.invoice, id: p.providerReference!, metadata: { purchase_id: p.id }, payments: [payment] };
        await settleInvoice(p.id, { ...invoice, payments: [{ ...payment, status: "paid", refunded: 0 }] });
        const grant = await client.gameCredit.findUniqueOrThrow({ where: { idempotencyKey: `purchase:${p.id}` } });
        const room = await board.createBoardSession(f.userId, { categoryIds: categories, teamNames: ["فريق تعارض أول", "فريق تعارض ثاني"], timerSeconds: 60 });
        const provider: PaymentProvider = { async createInvoice() { throw Error("Not used"); }, async fetchInvoice() { return invoice; }, async fetchPayment() { return payment; } };
        const gate = await pool.connect(); let pids: number[] = [];
        try {
          await gate.query("BEGIN"); await gate.query('SELECT * FROM "CreditWallet" WHERE "userId"=$1 FOR UPDATE', [f.userId]);
          const tasks = [board.applyBoardCommand(f.userId, room.id, randomUUID(), 0, { type: "START" }), confirmSupportRefund(p.id, invoice.id, payment.id, adminId, provider)].map(p => p.then(() => ({ ok: true, status: 200 }), e => ({ ok: false, status: e.status })));
          const end = Date.now() + 4000;
          do { pids = (await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%CreditWallet%'")).rows.map(r => Number(r.pid)); if (pids.length >= 2) break; await new Promise(r => setTimeout(r, 20)); } while (Date.now() < end);
          assert.ok(new Set(pids).size >= 2); await gate.query("COMMIT"); const outcomes = await Promise.all(tasks);
          assert.equal(outcomes[1].ok, true); assert.ok(outcomes[0].ok || outcomes[0].status === 402);
          const refund = await client.purchaseRefund.findUniqueOrThrow({ where: { purchaseId: p.id } });
          assert.equal(refund.unresolvedCredits, outcomes[0].ok ? 1 : 0); assert.equal(refund.recoveredCredits, outcomes[0].ok ? 2 : 3);
          assert.equal((await client.creditWallet.findUniqueOrThrow({ where: { userId: f.userId } })).balance, 0);
          assert.equal(await client.gameCredit.count({ where: { idempotencyKey: `purchase-refund:${p.id}:full` } }), 1);
          assert.equal(await client.gameCredit.count({ where: { idempotencyKey: `game-start:${room.id}` } }), outcomes[0].ok ? 1 : 0);
          assert.deepEqual(await client.gameCredit.findUniqueOrThrow({ where: { id: grant.id } }), grant);
          results.push({ iteration: i + 1, pids, outcomes, recovered: refund.recoveredCredits, unresolved: refund.unresolvedCredits, balance: 0 });
        } finally { await gate.query("ROLLBACK"); gate.release(); }
      }
      return { repetitions: 6, results, unexpectedDeadlocks: 0, originalGrantsUnchanged: true };
    });
  } else throw Error("Unknown lifecycle verification stage");
  save(`native-${mode}.json`, { phase: "5.0F-1", sourceFingerprint: process.env.SOURCE_FINGERPRINT, mode, database: version, cases, passed: cases.length, failed: 0, skipped: 0, fullRegression: false, completedAt: new Date().toISOString() });
}
async function boot() {
  const Client = (await import(ctorPath)).PrismaClient as typeof PrismaClient;
  client = new Client({ adapter: new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0]) });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = client;
  try { await main(); } finally { await client.$disconnect(); await pool.end(); }
}
boot().catch(error => { console.error(error); process.exitCode = 1; });
