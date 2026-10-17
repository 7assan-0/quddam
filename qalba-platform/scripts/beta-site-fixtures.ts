/** Append-only, wholly synthetic 36-cell board bank and canonical test grant.
 * Requires the inherited external marker/loopback database guard. Never a seed
 * entrypoint or an application dependency; existing content/results are untouched.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { db } from "../src/lib/db";
import { grantAdminCredits } from "../src/lib/billing/credits";
import { isolatedEnvironment, loadFixture } from "./night-mvp-fixtures";

async function main() {
  const { output } = isolatedEnvironment();
  const fixture = await loadFixture();
  const identity = await db().$queryRaw<{ version: string }[]>`SELECT version() AS version`;
  assert.match(identity[0].version, /^PostgreSQL 17\./);
  if (process.argv.includes("--bank")) {
    const receipt = join(output, "beta-site-bank.private.json");
    if (existsSync(receipt)) {
      assert.equal(JSON.parse(readFileSync(receipt, "utf8")).run, fixture.run);
      console.log("Synthetic site content already exists; existing records preserved.");
      return;
    }
    const game = await db().gameType.findUniqueOrThrow({ where: { slug: "category-board" } });
    const ids = await db().$transaction(async tx => {
      const rows = [];
      for (let index = 1; index <= 6; index++) rows.push(await tx.category.create({ data: {
        slug: `beta-site-${fixture.run}-${index}`, title: `اختبار محلي ${index}`, sortOrder: 100 + index,
        questions: { create: [200, 400, 600].flatMap(pointValue => [1, 2].map(variant => ({ gameTypeId: game.id,
          question: `سؤال اصطناعي للفئة ${index} بقيمة ${pointValue} نسخة ${variant}؟`, answer: "إجابة اصطناعية",
          alternativeAnswers: [], difficulty: "EASY", pointValue, type: "TEXT", status: "PUBLISHED" }))) },
      } }));
      return rows.map(row => row.id);
    });
    writeFileSync(receipt, JSON.stringify({ run: fixture.run, categoryIds: ids }), { mode: 0o600, flag: "wx" });
    console.log("Created six new synthetic categories and thirty-six eligible questions; no existing content changed.");
    return;
  }
  const input = process.env.BETA_SITE_ACCOUNT_FILE;
  assert.ok(input && isAbsolute(input), "External browser-created synthetic account file required");
  const path = realpathSync(input);
  assert.ok(relative(process.cwd(), path).startsWith(".."));
  assert.equal(statSync(path).mode & 0o077, 0);
  const account = JSON.parse(readFileSync(path, "utf8")) as { email: string; run: string };
  assert.equal(account.run, fixture.run);
  assert.match(account.email, /^beta-site-[a-f0-9-]+@example\.test$/);
  const user = await db().user.findUniqueOrThrow({ where: { email: account.email } });
  assert.equal(user.name, "مضيف قبول الموقع الاصطناعي");
  assert.ok(user.passwordHash, "Account must have been registered through the real browser UI");
  assert.equal(user.role, "USER");
  assert.equal(await db().gameSession.count({ where: { hostId: user.id } }), 0);
  await grantAdminCredits(fixture.adminId, account.email, 3, `beta-site-browser-${fixture.run}-${user.id}`);
  console.log("Canonical admin fixture grant applied to the browser-created synthetic account only.");
}
main().catch(() => { console.error("Guarded synthetic site fixture failed; private values withheld."); process.exitCode = 1; })
  .finally(() => db().$disconnect());
