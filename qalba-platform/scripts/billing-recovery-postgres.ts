/** Dedicated PostgreSQL contract harness; no public provider network. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { db } from "../src/lib/db";
import { startCheckout, reconcilePurchase } from "../src/lib/billing/checkout";
import { ensureInvoice } from "../src/lib/billing/invoice-creation";
import { reconcileBatch } from "../src/lib/billing/reconciliation";
import { PaymentError, type Invoice, type PaymentProvider } from "../src/lib/billing/provider";

async function main() {
  assert.equal(process.env.BILLING_TEST_DATABASE, "1");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const version = (await pool.query("SELECT version() AS version")).rows[0].version;
  assert.match(version, /^PostgreSQL /); assert.doesNotMatch(version, /PGlite/i);
  const results: { name: string; evidence: unknown }[] = [];
  const user = await db().user.create({ data: { email: `${randomUUID()}@example.test`, name: "Recovery fixture" } });
  const product = await db().product.create({ data: { slug: randomUUID(), title: "Recovery fixture", priceHalalas: 1500, credits: 3, active: true } });
  await db().featureFlag.upsert({ where: { key: "welcome-credits" }, create: { key: "welcome-credits", enabled: false, config: { count: 0 } }, update: { enabled: false, config: { count: 0 } } });
  const remote = new Map<string, Invoice>(); let calls = 0, recoveries = 0;
  const provider: PaymentProvider = {
    async createInvoice(input) { calls++; const invoice = { id: randomUUID(), amount: input.amount, currency: "SAR", status: "initiated", url: "https://checkout.moyasar.com/invoices/test", metadata: { purchase_id: input.purchaseId } }; remote.set(input.purchaseId, invoice); return invoice; },
    async recoverInvoice(id) { recoveries++; return remote.get(id) ?? null; },
    async fetchInvoice(id) { const invoice = [...remote.values()].find(i => i.id === id); if (!invoice) throw new PaymentError("not found", 404); return invoice; },
  };
  async function fixture(state = "NOT_CREATED") {
    return db().purchase.create({ data: { userId: user.id, productId: product.id, amountHalalas: 1500, credits: 3, provider: "moyasar", expiresAt: new Date(Date.now() + 1800000), idempotencyKey: randomUUID(), invoiceCreationState: state } });
  }
  const run = async (name: string, fn: () => Promise<unknown>) => { const evidence = await fn(); results.push({ name, evidence }); console.log("PASS", name); };
  await run("normal creation and repeated checkout reserve/link once", async () => {
    const coupon = await db().coupon.create({ data: { code: randomUUID().toUpperCase(), discountPercent: 10, maxUses: 1, active: true } });
    const key = randomUUID(), before = calls;
    const p = await startCheckout(user.id, product.id, coupon.code, key, provider);
    const again = await startCheckout(user.id, product.id, coupon.code, key, provider);
    assert.equal(again.id, p.id); assert.equal(calls - before, 1);
    assert.equal(p.invoiceCreationState, "CREATED");
    assert.equal((await db().coupon.findUniqueOrThrow({ where: { id: coupon.id } })).reservedCount, 1);
    remote.set(p.id, { ...remote.get(p.id)!, status: "paid" }); await reconcilePurchase(p.id, provider);
    return { creations: 1, references: 1, reservations: 1 };
  });
  await run("crash before durable send claim safely retries", async () => {
    const p = await fixture(), before = calls; await ensureInvoice(p.id, provider); assert.equal(calls - before, 1); return { initialState: p.invoiceCreationState };
  });
  await run("lost provider response recovers without duplicate", async () => {
    const p = await fixture(), before = calls;
    await assert.rejects(ensureInvoice(p.id, { ...provider, async createInvoice(i) { await provider.createInvoice(i); throw new Error("lost response"); } }));
    assert.equal((await db().purchase.findUniqueOrThrow({ where: { id: p.id } })).invoiceCreationState, "UNKNOWN_OUTCOME");
    const recovered = await ensureInvoice(p.id, provider); await ensureInvoice(p.id, provider);
    assert.equal(calls - before, 1); assert.equal(recovered.providerReference, remote.get(p.id)!.id); return { creations: 1, recovered: true };
  });
  await run("database failure after provider success keeps committed intent", async () => {
    const p = await fixture(), before = calls;
    await pool.query(`CREATE FUNCTION test_fail_invoice_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${p.id}' AND NEW."providerReference" IS NOT NULL THEN RAISE EXCEPTION 'injected link failure'; END IF; RETURN NEW; END $$`);
    await pool.query('CREATE TRIGGER test_fail_invoice_link BEFORE UPDATE ON "Purchase" FOR EACH ROW EXECUTE FUNCTION test_fail_invoice_link()');
    try { await assert.rejects(ensureInvoice(p.id, provider)); } finally { await pool.query('DROP TRIGGER test_fail_invoice_link ON "Purchase"'); await pool.query('DROP FUNCTION test_fail_invoice_link()'); }
    assert.equal((await db().purchase.findUniqueOrThrow({ where: { id: p.id } })).invoiceCreationState, "UNKNOWN_OUTCOME");
    assert.equal((await ensureInvoice(p.id, provider)).providerReference, remote.get(p.id)!.id); assert.equal(calls - before, 1); return { rolledBackLink: true, committedIntent: true, creations: 1 };
  });
  await run("foreign purchase, amount, currency and conflicting reference rejected", async () => {
    const p = await fixture("UNKNOWN_OUTCOME");
    const good: Invoice = { id: randomUUID(), status: "initiated", amount: 1500, currency: "SAR", url: "https://checkout.moyasar.com/test", metadata: { purchase_id: p.id } };
    for (const candidate of [{ ...good, metadata: { purchase_id: "other" } }, { ...good, amount: 1 }, { ...good, currency: "USD" }]) await assert.rejects(ensureInvoice(p.id, { ...provider, async recoverInvoice() { return candidate; } }));
    assert.equal((await db().purchase.findUniqueOrThrow({ where: { id: p.id } })).providerReference, null); return { rejected: 3 };
  });
  await run("unknown absent invoice never blindly recreated or locally expired", async () => {
    const p = await fixture("UNKNOWN_OUTCOME"), before = calls;
    await db().purchase.update({ where: { id: p.id }, data: { expiresAt: new Date(0) } });
    for (let i = 0; i < 2; i++) await assert.rejects(ensureInvoice(p.id, provider));
    assert.equal(calls, before); return { noCreate: true, manualRecoveryWhenAbsent: true };
  });
  await run("HTTP runs outside Purchase transaction and concurrent retries link once", async () => {
    const p = await fixture(); let release!: () => void, entered!: () => void;
    const waiting = new Promise<void>(r => { entered = r; }), gate = new Promise<void>(r => { release = r; });
    const first = ensureInvoice(p.id, { ...provider, async createInvoice(i) { entered(); await gate; return provider.createInvoice(i); } });
    await waiting;
    const c = await pool.connect(); await c.query("BEGIN"); await c.query('SELECT id FROM "Purchase" WHERE id=$1 FOR UPDATE NOWAIT', [p.id]); await c.query("COMMIT"); c.release();
    await assert.rejects(ensureInvoice(p.id, provider)); release(); const linked = await first;
    assert.equal((await ensureInvoice(p.id, provider)).providerReference, linked.providerReference); return { rowUnlockedDuringHttp: true };
  });
  // Isolate queue assertions from creation fixtures; no financial effects are asserted by these cleanup markers.
  await db().purchase.updateMany({ where: { userId: user.id, status: "PENDING" }, data: { nextReconcileAt: new Date("2099-01-01") } });
  async function queued(createdAt: Date) {
    const p = await fixture(); const invoice = await provider.createInvoice({ amount: p.amountHalalas, title: "test", purchaseId: p.id, expiresAt: p.expiresAt! });
    return db().purchase.update({ where: { id: p.id }, data: { providerReference: invoice.id, invoiceCreationState: "CREATED", createdAt, nextReconcileAt: new Date(0) } });
  }
  await run("50 old pending cannot starve newer purchase; bounded concurrency", async () => {
    const old = []; for (let i = 0; i < 50; i++) old.push(await queued(new Date(1000 + i)));
    const newer = await queued(new Date()); remote.set(newer.id, { ...remote.get(newer.id)!, status: "paid" });
    let active = 0, max = 0;
    const counted = { ...provider, async fetchInvoice(id: string) { active++; max = Math.max(max, active); await new Promise(r => setTimeout(r, 5)); try { return await provider.fetchInvoice(id); } finally { active--; } } };
    const first = await reconcileBatch(counted); assert.equal(first.checked, 50); assert.ok(max <= 3);
    const second = await reconcileBatch(counted); assert.equal(second.checked, 1); assert.equal(second.updated, 1);
    assert.equal((await db().purchase.findUniqueOrThrow({ where: { id: newer.id } })).status, "PAID");
    await db().purchase.updateMany({ where: { id: { in: old.map(p => p.id) } }, data: { nextReconcileAt: new Date("2099-01-01") } });
    return { batches: [first.checked, second.checked], maxConcurrent: max, newerPaid: true };
  });
  await run("errors back off, retry later and terminal leaves queue", async () => {
    const p = await queued(new Date()); let attempts = 0;
    const failing = { ...provider, async fetchInvoice() { attempts++; throw new Error("temporary"); } };
    const first = await reconcileBatch(failing); assert.equal(first.outcomes[0].outcome, "TRANSIENT_ERROR");
    const scheduled = await db().purchase.findUniqueOrThrow({ where: { id: p.id } });
    assert.ok(scheduled.nextReconcileAt.getTime() >= scheduled.lastReconcileAttemptAt!.getTime() + 60000);
    assert.equal((await reconcileBatch(failing)).checked, 0); assert.equal(attempts, 1);
    const later = new Date(scheduled.nextReconcileAt.getTime() + 1);
    await reconcileBatch(failing, later); assert.equal(attempts, 2);
    const pending = await db().purchase.findUniqueOrThrow({ where: { id: p.id } }); assert.equal(pending.status, "PENDING");
    remote.set(p.id, { ...remote.get(p.id)!, status: "paid" });
    assert.equal((await reconcileBatch(provider, new Date(pending.nextReconcileAt.getTime() + 1))).updated, 1);
    assert.equal((await reconcileBatch(provider, new Date("2098-01-01"))).outcomes.some(o => o.id === p.id), false);
    return { attempts, firstDelayMs: 60000, secondDelayMs: 120000, terminalRemoved: true };
  });
  await run("concurrent cron leases skip locked row and use B01 exactly once", async () => {
    const p = await queued(new Date()); remote.set(p.id, { ...remote.get(p.id)!, status: "paid" });
    let release!: () => void, entered!: () => void; const gate = new Promise<void>(r => { release = r; }), waiting = new Promise<void>(r => { entered = r; });
    const first = reconcileBatch({ ...provider, async fetchInvoice(id) { entered(); await gate; return provider.fetchInvoice(id); } });
    await waiting; const second = await reconcileBatch(provider); assert.equal(second.checked, 0); release(); assert.equal((await first).updated, 1);
    assert.equal(await db().gameCredit.count({ where: { idempotencyKey: `purchase:${p.id}` } }), 1);
    assert.equal(await db().analyticsEvent.count({ where: { name: "PURCHASE_COMPLETED", properties: { path: ["purchaseId"], equals: p.id } } }), 1);
    return { competingCronChecked: 0, grants: 1, completions: 1 };
  });
  await run("404 and unknown creation classified without failing payment", async () => {
    const p = await queued(new Date()), unknown = await fixture("UNKNOWN_OUTCOME");
    await db().purchase.update({ where: { id: unknown.id }, data: { nextReconcileAt: new Date(0) } }); remote.delete(p.id);
    const batch = await reconcileBatch(provider); assert.ok(batch.outcomes.some(o => o.id === p.id && o.outcome === "NOT_FOUND")); assert.ok(batch.outcomes.some(o => o.id === unknown.id && o.outcome === "CREATION_UNKNOWN"));
    assert.equal((await db().purchase.findUniqueOrThrow({ where: { id: p.id } })).status, "PENDING"); assert.equal((await db().purchase.findUniqueOrThrow({ where: { id: unknown.id } })).status, "PENDING"); return batch.outcomes;
  });
  await writeFile(process.env.BILLING_RECOVERY_REPORT ?? "billing-recovery-postgres.json", JSON.stringify({ version, passed: results.length, creations: calls, recoveries, results }, null, 2));
  await pool.end(); await db().$disconnect();
}
main().catch(error => { console.error(error); process.exit(1); });
