import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const database = await PGlite.create();
const migration = "20261005210000_invoice_recovery_reconciliation";
let assertions = 0;
try {
  for (const name of (await readdir("prisma/migrations")).filter(n => n < migration).sort()) {
    if (name !== "migration_lock.toml") await database.exec(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
  }
  await database.exec(`INSERT INTO "User" (id,email,name,"updatedAt") VALUES ('upgrade-user','upgrade@example.test','fixture',CURRENT_TIMESTAMP);
    INSERT INTO "Product" (id,slug,title,credits,"priceHalalas") VALUES ('upgrade-product','upgrade','fixture',3,1500);
    INSERT INTO "Purchase" (id,"userId","productId","amountHalalas",credits,"idempotencyKey",status,"providerReference") VALUES
      ('old-linked','upgrade-user','upgrade-product',1500,3,'linked','PENDING','old-reference'),
      ('old-unknown','upgrade-user','upgrade-product',1500,3,'unknown','PENDING',NULL),
      ('old-paid','upgrade-user','upgrade-product',1500,3,'paid','PAID','paid-reference');`);
  const before = (await database.query('SELECT id,status,"amountHalalas",credits,"providerReference" FROM "Purchase" ORDER BY id')).rows;
  await database.exec(await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"));
  assert.deepEqual((await database.query('SELECT id,status,"amountHalalas",credits,"providerReference" FROM "Purchase" ORDER BY id')).rows, before); assertions++;
  const rows = (await database.query('SELECT id,"invoiceCreationState","reconcileAttemptCount","nextReconcileAt" FROM "Purchase" ORDER BY id')).rows;
  assert.equal(rows.find(r => r.id === "old-linked").invoiceCreationState, "CREATED"); assertions++;
  assert.equal(rows.find(r => r.id === "old-unknown").invoiceCreationState, "UNKNOWN_OUTCOME"); assertions++;
  assert.equal(rows.find(r => r.id === "old-paid").invoiceCreationState, "CREATED"); assertions++;
  assert.ok(rows.every(r => r.reconcileAttemptCount === 0 && r.nextReconcileAt)); assertions++;
  await database.exec(`INSERT INTO "Purchase" (id,"userId","productId","amountHalalas","idempotencyKey") VALUES ('new','upgrade-user','upgrade-product',1500,'new');`);
  assert.equal((await database.query('SELECT "invoiceCreationState" FROM "Purchase" WHERE id=\'new\'')).rows[0].invoiceCreationState, "NOT_CREATED"); assertions++;
  await assert.rejects(database.exec(`UPDATE "Purchase" SET "invoiceCreationState"='INVALID' WHERE id='new'`)); assertions++;
  await assert.rejects(database.exec(`UPDATE "Purchase" SET "reconcileAttemptCount"=-1 WHERE id='new'`)); assertions++;
  const evidence = { passed: assertions, legacyFinancialColumnsPreserved: true, unknownLegacyNotAssumedSafeToCreate: true };
  await writeFile(process.env.BILLING_MIGRATION_REPORT ?? "billing-recovery-migration.json", JSON.stringify(evidence, null, 2)); console.log(evidence);
} finally { await database.close(); }
