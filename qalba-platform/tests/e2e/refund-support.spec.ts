import { test, expect, type APIRequestContext } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";
const exec = promisify(execFile), origin = "http://127.0.0.1:3000", headers = { Origin: origin };
type Fixture = { purchaseId: string; invoiceId: string; paymentId: string; userId: string; adminToken: string; userToken: string; productId: string };
async function setup(mode = "refund", used = "0"): Promise<Fixture> {
  if (process.env.BILLING_TEST_DATABASE !== "1") throw new Error("Requires isolated native PG and contract fixture");
  const result = await exec("node", ["--import", "tsx", "scripts/refund-browser-fixture.ts", mode, used], { env: process.env });
  return JSON.parse(result.stdout);
}
async function observe(invoice: string, state: string) { await exec("node", ["--import", "tsx", "scripts/refund-browser-fixture.ts", "observe", invoice, state], { env: process.env }); }
async function sql<T>(fn: (p: Pool) => Promise<T>) { const p = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 2 }); try { return await fn(p); } finally { await p.end(); } }
const auth = (token: string) => ({ ...headers, Cookie: `qalba_session=${token}` });
const path = (f: Fixture) => `/api/admin/purchases/${f.purchaseId}/refund`;
const data = (f: Fixture) => ({ providerReference: f.invoiceId, paymentReference: f.paymentId });
async function financial(f: Fixture) { return sql(async p => ({
  purchase: (await p.query('SELECT * FROM "Purchase" WHERE id=$1', [f.purchaseId])).rows[0],
  wallet: (await p.query('SELECT * FROM "CreditWallet" WHERE "userId"=$1', [f.userId])).rows[0],
  grant: (await p.query('SELECT * FROM "GameCredit" WHERE "idempotencyKey"=$1', [`purchase:${f.purchaseId}`])).rows[0],
  credits: (await p.query('SELECT * FROM "GameCredit" WHERE "userId"=$1 ORDER BY id', [f.userId])).rows,
  refund: (await p.query('SELECT * FROM "PurchaseRefund" WHERE "purchaseId"=$1', [f.purchaseId])).rows[0],
})); }
async function confirm(api: APIRequestContext, f: Fixture) { return api.post(path(f), { headers: auth(f.adminToken), data: data(f) }); }

test("M03 01 normal checkout callback and poll preserve one grant and classified audit", async ({ request, page }) => {
  const f = await setup("checkout");
  const response = await request.post("/api/billing/checkout", { headers: auth(f.userToken), data: { productId: f.productId, key: crypto.randomUUID() } }); expect(response.status()).toBe(200);
  const purchase = await response.json(); f.purchaseId = purchase.id;
  f.invoiceId = await sql(async p => (await p.query('SELECT "providerReference" FROM "Purchase" WHERE id=$1', [f.purchaseId])).rows[0].providerReference);
  await observe(f.invoiceId, "paid");
  for (let i = 0; i < 3; i++) expect((await request.post(`/api/billing/callback?token=${process.env.MOYASAR_CALLBACK_TOKEN}`, { data: { id: f.invoiceId } })).status()).toBe(200);
  expect((await request.post(`/api/billing/purchases/${f.purchaseId}`, { headers: auth(f.userToken) })).status()).toBe(200);
  const saved = await financial(f); expect(saved.purchase.status).toBe("PAID"); expect(saved.wallet.balance).toBe(3); expect(saved.grant.delta).toBe(3);
  const events = await sql(async p => (await p.query('SELECT * FROM "PaymentEvent" WHERE "purchaseId"=$1', [f.purchaseId])).rows);
  expect(events.filter(e => e.source === "CALLBACK")).toHaveLength(1); expect(events.some(e => e.source === "POLL")).toBe(true); expect(events.some(e => e.eventType === "INVOICE_CREATION_INTENT")).toBe(true);
  expect(JSON.stringify(events)).not.toMatch(/SENSITIVE|secret_token|callback_url|source.*number/);
  await page.context().addCookies([{ name: "qalba_session", value: f.userToken, url: origin, httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/pricing"); await expect(page).toHaveURL(/\/pricing$/); await expect(page).toHaveTitle(/قدّام/); await expect(page.getByRole("heading", { name: "باقة تحقق الاسترداد", exact: true }).first()).toBeVisible();
});
test("M03 02 support authorization origin and strict request boundary", async ({ request }) => {
  const f = await setup(), before = await financial(f);
  for (const h of [headers, auth(f.userToken)]) { expect((await request.post(path(f), { headers: h, data: data(f) })).status()).toBe(403); expect((await request.get(path(f), { headers: h })).status()).toBe(403); }
  expect((await request.post(path(f), { headers: { ...auth(f.adminToken), Origin: "https://attacker.invalid" }, data: data(f) })).status()).toBe(403);
  expect((await request.post(path(f), { headers: auth(f.adminToken), data: { ...data(f), delta: -100, userId: "other" } })).status()).toBe(400);
  expect(await financial(f)).toEqual(before);
});
for (const [used, n] of [[0, "03"], [2, "04"], [3, "05"]] as const) test(`M03 ${n} verified full refund after ${used} credits consumed`, async ({ request }) => {
  const f = await setup("refund", String(used)), before = await financial(f);
  const result = await confirm(request, f); expect(result.status()).toBe(200); expect(await result.json()).toMatchObject({ state: "REFUNDED", recoveredCredits: 3 - used, unresolvedCredits: used, supportStatus: used ? "SUPPORT_REQUIRED" : "RESOLVED" });
  const after = await financial(f); expect(after.purchase).toEqual(before.purchase); expect(after.grant).toEqual(before.grant); expect(after.wallet.balance).toBe(0); expect(after.credits.filter(c => c.idempotencyKey === `purchase-refund:${f.purchaseId}:full`)).toHaveLength(1);
});
test("M03 06 concurrent callback cron and support plus retry compensate once", async ({ request }) => {
  const f = await setup();
  await sql(p => p.query(`UPDATE "Purchase" SET "nextReconcileAt"='2099-01-01' WHERE status='PAID' AND id<>$1`, [f.purchaseId]));
  const result = await Promise.all([confirm(request, f), request.post(`/api/billing/callback?token=${process.env.MOYASAR_CALLBACK_TOKEN}`, { data: { id: crypto.randomUUID(), type: "payment_refunded", data: { id: f.paymentId, invoice_id: f.invoiceId, amount: 1 }, secret_token: "SENSITIVE_CALLBACK_SENTINEL" } }), request.post("/api/billing/reconcile", { headers: { Authorization: `Bearer ${process.env.BILLING_CRON_SECRET}` } })]);
  expect(result.map(r => r.status())).toEqual([200, 200, 200]);
  const before = await financial(f); for (let i = 0; i < 5; i++) { expect((await confirm(request, f)).status()).toBe(200); }
  expect(await financial(f)).toEqual(before); expect(before.wallet.balance).toBe(0); expect(before.credits.filter(c => c.idempotencyKey.startsWith("purchase-refund:"))).toHaveLength(1);
});
test("M03 07 partial refund wrong reference and unknown purchase fail closed", async ({ request }) => {
  const f = await setup(); await observe(f.invoiceId, "partial"); const before = await financial(f);
  expect((await confirm(request, f)).status()).toBe(409);
  expect((await request.post(path(f), { headers: auth(f.adminToken), data: { ...data(f), paymentReference: crypto.randomUUID() } })).status()).toBe(409);
  expect((await request.post("/api/admin/purchases/unknown/refund", { headers: auth(f.adminToken), data: data(f) })).status()).toBe(404);
  expect(await financial(f)).toEqual(before);
});
test("M03 08 forged callback refund fields cannot authorize a compensation", async ({ request }) => {
  const f = await setup(); await observe(f.invoiceId, "paid"); const before = await financial(f);
  expect((await request.post(`/api/billing/callback?token=${process.env.MOYASAR_CALLBACK_TOKEN}`, { data: { id: f.invoiceId, status: "refunded", amount: 1500, currency: "SAR" } })).status()).toBe(200);
  expect((await confirm(request, f)).status()).toBe(409); expect(await financial(f)).toEqual(before);
});
test("M03 09 admin safe audit read exposes unresolved support remainder", async ({ request }) => {
  const f = await setup("refund", "3"); expect((await confirm(request, f)).status()).toBe(200);
  const response = await request.get(path(f), { headers: auth(f.adminToken) }); expect(response.status()).toBe(200); const body = await response.json();
  expect(body.status).toBe("PAID"); expect(body.refund).toMatchObject({ unresolvedCredits: 3, supportStatus: "SUPPORT_REQUIRED", recoveredCredits: 0 });
  expect(body.events.some((e: { source: string; operatorId: string }) => e.source === "SUPPORT" && e.operatorId)).toBe(true);
  expect(JSON.stringify(body)).not.toMatch(/SENSITIVE|secret_token|passwordHash|providerReference|paymentReference|callback_url|card/);
});
