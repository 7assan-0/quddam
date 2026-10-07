import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { expireUninvoicedPurchases, reconcilePurchase, settleInvoice, startCheckout } from "../src/lib/billing/checkout";
import type { Invoice, PaymentProvider } from "../src/lib/billing/provider";
import { pruneAnalytics } from "../src/lib/analytics/events";

const invoices = new Map<string, Invoice>();
let creations = 0;
const provider: PaymentProvider = { async createInvoice(input) { creations++; const invoice = { id: randomUUID(), status: "initiated", amount: input.amount, currency: "SAR", metadata: { purchase_id: input.purchaseId }, url: `https://checkout.moyasar.com/invoices/${randomUUID()}` }; invoices.set(invoice.id, invoice); return invoice; },
  async fetchInvoice(id) { return invoices.get(id)!; } };
async function main() {
  const user = await db().user.create({ data: { email: `${randomUUID()}@example.test`, name: "مشتري" } });
  const product = await db().product.create({ data: { slug: `pack-${randomUUID()}`, title: "باقة ثلاثة", credits: 3, priceHalalas: 1500, active: true } });
  const coupon = await db().coupon.create({ data: { code: `C${randomUUID().slice(0, 8).toUpperCase()}`, discountPercent: 20, maxUses: 1, active: true } });
  const key = randomUUID(); const purchase = await startCheckout(user.id, product.id, coupon.code, key, provider);
  assert.equal(purchase.amountHalalas, 1200); assert.equal(purchase.credits, 3);
  assert.equal((await startCheckout(user.id, product.id, coupon.code, key, provider)).id, purchase.id); assert.equal(creations, 1);
  await assert.rejects(startCheckout(user.id, product.id, coupon.code, randomUUID(), provider));
  await db().product.update({ where: { id: product.id }, data: { credits: 99, priceHalalas: 9999 } });
  await assert.rejects(settleInvoice(purchase.id, { ...invoices.get(purchase.providerReference!)!, status: "paid", amount: 1 }));
  assert.equal((await db().creditWallet.findUnique({ where: { userId: user.id } }))?.balance ?? 0, 0);
  invoices.set(purchase.providerReference!, { ...invoices.get(purchase.providerReference!)!, status: "paid" });
  const paid = await reconcilePurchase(purchase.id, provider); assert.equal(paid.status, "PAID");
  await reconcilePurchase(purchase.id, provider);
  assert.equal((await db().creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance, 6);
  const abandoned = await db().purchase.create({ data: { userId: user.id, productId: product.id, couponId: coupon.id, couponReserved: true, amountHalalas: 1200, credits: 3, idempotencyKey: `checkout:${randomUUID()}`, expiresAt: new Date(Date.now() - 1000) } });
  await db().coupon.update({ where: { id: coupon.id }, data: { reservedCount: { increment: 1 } } });
  assert.equal(await expireUninvoicedPurchases(), 1);
  assert.equal((await db().purchase.findUniqueOrThrow({ where: { id: abandoned.id } })).status, "FAILED");
  assert.equal((await db().coupon.findUniqueOrThrow({ where: { id: coupon.id } })).reservedCount, 0);
  const oldEvent = await db().analyticsEvent.create({ data: { name: "GAME_STARTED", userId: user.id, occurredAt: new Date(Date.now() - 91 * 86400_000) } });
  assert.equal((await pruneAnalytics()).count, 1);
  assert.equal(await db().analyticsEvent.count({ where: { id: oldEvent.id } }), 0);
  assert.equal(await db().gameCredit.count({ where: { idempotencyKey: `purchase:${purchase.id}` } }), 1);
  assert.equal(await db().analyticsEvent.count({ where: { name: "PURCHASE_STARTED", userId: user.id } }), 1);
  assert.equal(await db().analyticsEvent.count({ where: { name: "PURCHASE_COMPLETED", userId: user.id } }), 1);
  assert.deepEqual(await db().coupon.findUniqueOrThrow({ where: { id: coupon.id }, select: { reservedCount: true, usedCount: true } }), { reservedCount: 0, usedCount: 1 });
  const failed = await startCheckout(user.id, product.id, undefined, randomUUID(), provider);
  invoices.set(failed.providerReference!, { ...invoices.get(failed.providerReference!)!, status: "failed" });
  assert.equal((await reconcilePurchase(failed.id, provider)).status, "FAILED");
  assert.equal((await db().creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance, 6);
  await db().$disconnect(); console.log("Checkout snapshot, coupon limit, reconciliation, duplicate prevention and failure passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
