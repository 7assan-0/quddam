/** Add registered, wholly synthetic Beta acceptance accounts to the guarded new DB.
 * Never imported by application code. No existing account, game result, or pricing writes.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { grantAdminCredits } from "../src/lib/billing/credits";
import { isolatedEnvironment, loadFixture } from "./night-mvp-fixtures";

export type BetaFixture = { run: string; nativeOwnerId: string; memberIds: string[] };
export async function loadBetaFixture(): Promise<BetaFixture> {
  const { output } = isolatedEnvironment();
  const original = await loadFixture();
  const identity = await db().$queryRaw<{ version: string }[]>`SELECT version() AS version`;
  assert.match(identity[0].version, /^PostgreSQL 17\./, "Native PostgreSQL 17 required");
  const fixture = JSON.parse(readFileSync(join(output, "beta-fixture.private.json"), "utf8")) as BetaFixture;
  assert.equal(fixture.run, original.run, "Synthetic Beta marker mismatch");
  assert.equal(fixture.memberIds.length, 24);
  assert.equal(new Set([fixture.nativeOwnerId, ...fixture.memberIds]).size, 25);
  assert.equal(await db().user.count({ where: { id: { in: [fixture.nativeOwnerId, ...fixture.memberIds] } } }), 25);
  return fixture;
}
/** Each rerun gets a new quota/wallet owner; no deletion or resetting old results. */
export async function createBetaNativeOwner() {
  await loadBetaFixture();
  const original = await loadFixture(), nonce = randomUUID();
  const account = await db().user.create({ data: { name: "منظم قبول شلّتك الاصطناعي",
    email: `beta-native-run-${nonce}@example.test` } });
  await grantAdminCredits(original.adminId, account.email, 100, `beta-native-run-${nonce}`);
  return account.id;
}
async function seed() {
  const { output } = isolatedEnvironment();
  const original = await loadFixture();
  const path = join(output, "beta-fixture.private.json");
  assert.equal(existsSync(path), false, "Non-overwriting Beta fixtures require a new evidence directory");
  const identity = await db().$queryRaw<{ version: string }[]>`SELECT version() AS version`;
  assert.match(identity[0].version, /^PostgreSQL 17\./);
  const nonce = randomUUID();
  const accounts = await db().$transaction(async tx => {
    const rows = [];
    for (let index = 0; index < 25; index++) rows.push(await tx.user.create({ data: {
      name: index ? `عضو قبول اصطناعي ${index}` : "منظم قبول شلّتك الاصطناعي",
      email: `beta-${nonce}-${index}@example.test`,
    } }));
    return rows;
  });
  await grantAdminCredits(original.adminId, accounts[0].email, 100, `beta-native-fixture-${nonce}`);
  const fixture: BetaFixture = { run: original.run, nativeOwnerId: accounts[0].id,
    memberIds: accounts.slice(1).map(account => account.id) };
  writeFileSync(path, JSON.stringify(fixture), { mode: 0o600, flag: "wx" });
  console.log("Guarded Beta synthetic registered accounts prepared; identities and credentials withheld.");
}
// Deliberately distinct: the inherited module executes its own seed for --seed.
if (process.argv.includes("--seed-beta")) seed().catch(() => {
  console.error("Synthetic Beta fixture setup failed; private values withheld."); process.exitCode = 1;
}).finally(() => db().$disconnect());
