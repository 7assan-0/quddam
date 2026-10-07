/** Forward upgrade on native PostgreSQL in an isolated temporary schema. */
import assert from "node:assert/strict";
import { Pool } from "pg";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
async function main() {
  assert.equal(process.env.BILLING_TEST_DATABASE, "1");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 }), client = await pool.connect();
  const name = `refund_upgrade_${randomUUID().replaceAll("-", "")}`, migration = "20261006040000_payment_events_refunds";
  let assertions = 0;
  try {
    await client.query(`CREATE SCHEMA "${name}"; SET search_path TO "${name}"`);
    for (const dir of (await readdir("prisma/migrations")).filter(n => n < migration).sort()) if (dir !== "migration_lock.toml") await client.query(await readFile(`prisma/migrations/${dir}/migration.sql`, "utf8"));
    await client.query(`INSERT INTO "User" (id,email,name,"updatedAt") VALUES ('legacy-user','legacy@example.test','fixture',CURRENT_TIMESTAMP);
      INSERT INTO "Product" (id,slug,title,credits,"priceHalalas") VALUES ('legacy-product','legacy','fixture',3,1500);
      INSERT INTO "Purchase" (id,"userId","productId","amountHalalas",credits,"idempotencyKey",status,"paidAt") VALUES ('legacy-paid','legacy-user','legacy-product',1500,3,'legacy-paid','PAID',CURRENT_TIMESTAMP);
      INSERT INTO "CreditWallet" ("userId",balance,"updatedAt") VALUES ('legacy-user',3,CURRENT_TIMESTAMP);
      INSERT INTO "GameCredit" (id,"userId",delta,reason,"idempotencyKey") VALUES ('legacy-grant','legacy-user',3,'paid original','purchase:legacy-paid');
      INSERT INTO "PaymentEvent" (id,provider,"externalId","processedAt") VALUES ('legacy-event','moyasar','old-identity',CURRENT_TIMESTAMP);`);
    const before = { purchase: (await client.query('SELECT * FROM "Purchase"')).rows, ledger: (await client.query('SELECT * FROM "GameCredit"')).rows, event: (await client.query('SELECT * FROM "PaymentEvent"')).rows[0] };
    await client.query(await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"));
    assert.deepEqual((await client.query('SELECT * FROM "Purchase"')).rows, before.purchase); assertions++;
    assert.deepEqual((await client.query('SELECT * FROM "GameCredit"')).rows, before.ledger); assertions++;
    const event = (await client.query('SELECT * FROM "PaymentEvent"')).rows[0];
    for (const [key,value] of Object.entries(before.event)) assert.deepEqual(event[key], value); assertions++;
    for (const key of ["purchaseId", "providerReference", "paymentReference", "source", "eventType", "observedState", "processingResult", "operatorId"]) assert.equal(event[key], null); assertions++;
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM "PurchaseRefund"')).rows[0].count, 0); assertions++;
    await assert.rejects(client.query(`INSERT INTO "PurchaseRefund" (id,"purchaseId",provider,"providerReference","paymentReference",state,"amountHalalas",currency,"grantedCredits","recoveredCredits","unresolvedCredits","supportStatus","ledgerKey","confirmedAt") VALUES ('bad','legacy-paid','moyasar','invoice','payment','REFUNDED',1500,'SAR',3,3,0,'RESOLVED','missing-ledger',CURRENT_TIMESTAMP)`)); assertions++;
    await client.query(`INSERT INTO "GameCredit" (id,"userId",delta,reason,"idempotencyKey") VALUES ('refund-grant','legacy-user',-3,'compensation','purchase-refund:legacy-paid:full');
      INSERT INTO "PurchaseRefund" (id,"purchaseId",provider,"providerReference","paymentReference",state,"amountHalalas",currency,"grantedCredits","recoveredCredits","unresolvedCredits","supportStatus","ledgerKey","confirmedAt") VALUES ('valid','legacy-paid','moyasar','invoice','payment','REFUNDED',1500,'SAR',3,3,0,'RESOLVED','purchase-refund:legacy-paid:full',CURRENT_TIMESTAMP)`); assertions++;
    for (const assignment of ['"recoveredCredits"=-1','"unresolvedCredits"=-1','"supportStatus"=\'SUPPORT_REQUIRED\'','"amountHalalas"=0','currency=\'USD\'']) { await assert.rejects(client.query(`UPDATE "PurchaseRefund" SET ${assignment} WHERE id='valid'`)); assertions++; }
    await assert.rejects(client.query('DELETE FROM "GameCredit" WHERE id=\'refund-grant\'')); assertions++;
    await assert.rejects(client.query('DELETE FROM "Purchase" WHERE id=\'legacy-paid\'')); assertions++;
    await writeFile(process.env.PAYMENT_MIGRATION_REPORT ?? "payment-events-migration.json", JSON.stringify({ nativePostgres: true, passed: assertions, legacyPaidGrantAndEventsPreserved: true, noFabricatedBackfill: true, compensatingLedgerForeignKey: true }, null, 2));
    console.log("PASS native payment events/refund forward upgrade", assertions);
  } finally { await client.query(`SET search_path TO public; DROP SCHEMA "${name}" CASCADE`); client.release(); await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
