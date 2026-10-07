/** Native DB + local contract fixture setup. Never production. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { createSession } from "../src/lib/auth/session";
import { settleInvoice } from "../src/lib/billing/checkout";
import { ensureWelcomeCredits } from "../src/lib/billing/credits";
async function main() {
  assert.equal(process.env.BILLING_TEST_DATABASE, "1"); assert.ok(process.env.E2E_DATABASE_URL?.includes("@127.0.0.1:"));
  const file = process.env.REFUND_PROVIDER_FIXTURE_FILE!; assert.ok(file);
  const data = JSON.parse(await readFile(file, "utf8"));
  const [mode, argument, value] = process.argv.slice(2);
  if (mode === "observe") {
    const invoice = data.invoices[argument]; assert.ok(invoice);
    invoice.status = value === "paid" ? "paid" : "paid";
    const payment = data.payments[invoice.payments[0].id]; payment.status = value === "paid" ? "paid" : "refunded";
    payment.refunded = value === "paid" ? 0 : value === "partial" ? 1 : payment.amount;
    payment.refunded_at = value === "paid" ? null : new Date().toISOString(); invoice.payments = [payment];
    await writeFile(file, JSON.stringify(data)); console.log(JSON.stringify({ updated: true })); return;
  }
  const admin = await db().user.findUniqueOrThrow({ where: { email: "admin@example.test" } });
  const user = await db().user.create({ data: { email: `${randomUUID()}@example.test`, name: "Refund browser fixture" } });
  const adminAuth = await createSession(admin.id), userAuth = await createSession(user.id);
  await db().$transaction(tx => ensureWelcomeCredits(tx, user.id));
  const product = await db().product.create({ data: { slug: randomUUID(), title: "باقة تحقق الاسترداد", credits: 3, priceHalalas: 1500, active: true } });
  if (mode === "checkout") { console.log(JSON.stringify({ productId: product.id, adminToken: adminAuth.token, userToken: userAuth.token, userId: user.id })); return; }
  const purchaseId = randomUUID(), invoiceId = randomUUID(), paymentId = randomUUID();
  const payment = { id: paymentId, invoice_id: invoiceId, status: "refunded", amount: 1500, currency: "SAR", refunded: 1500, captured: 0, refunded_at: new Date().toISOString(), voided_at: null };
  const invoice = { id: invoiceId, status: "paid", amount: 1500, currency: "SAR", metadata: { purchase_id: purchaseId }, url: `https://checkout.moyasar.com/invoices/${invoiceId}`, payments: [payment] };
  const purchase = await db().purchase.create({ data: { id: purchaseId, userId: user.id, productId: product.id, provider: "moyasar", providerReference: invoiceId, amountHalalas: 1500, credits: 3, invoiceCreationState: "CREATED", invoiceCreationAttemptAt: new Date(), idempotencyKey: randomUUID() } });
  await settleInvoice(purchaseId, invoice);
  const used = Number(argument ?? 0);
  if (used) await db().$transaction(async tx => { await tx.creditWallet.update({ where: { userId: user.id }, data: { balance: { decrement: used } } }); await tx.gameCredit.create({ data: { userId: user.id, delta: -used, reason: "Browser consumed fixture", idempotencyKey: randomUUID() } }); });
  data.invoices[invoiceId] = invoice; data.payments[paymentId] = payment; await writeFile(file, JSON.stringify(data));
  console.log(JSON.stringify({ purchaseId: purchase.id, invoiceId, paymentId, userId: user.id, adminToken: adminAuth.token, userToken: userAuth.token }));
}
main().finally(() => db().$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
