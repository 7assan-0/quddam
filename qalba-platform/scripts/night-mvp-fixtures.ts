/** Explicit synthetic fixtures for the isolated Night MVP acceptance database.
 * Never imported by application startup. Never modifies an existing content bank.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { db } from "../src/lib/db";
import { newToken, tokenHash } from "../src/lib/auth/crypto";
import { grantAdminCredits } from "../src/lib/billing/credits";
import { LAUNCH_GAMES } from "../src/lib/games/launch-policy";
import { normalize as normalizeRanked, validateList } from "../src/lib/games/ranked/module";
import { normalize as normalizeOrdering, validateQuestion } from "../src/lib/games/ordering/module";
import { validateAnswers } from "../src/lib/games/survey-battle/module";

export type SyntheticFixture = {
  run: string; ownerId: string; otherOwnerId: string; adminId: string;
  ownerToken: string; otherOwnerToken: string; initialCredits: number;
};
export function isolatedEnvironment() {
  assert.equal(process.env.NIGHT_MVP_SYNTHETIC, "1", "Explicit synthetic acceptance opt-in required");
  assert.notEqual(process.env.NODE_ENV, "production", "Fixture tools are prohibited in production");
  const envFile = process.env.NIGHT_MVP_ENV_FILE;
  assert.ok(envFile && isAbsolute(envFile), "Private environment file required");
  const envPath = realpathSync(envFile);
  assert.ok(relative(process.cwd(), envPath).startsWith(".."), "Private environment must be outside checkout");
  assert.equal(statSync(envPath).mode & 0o077, 0, "Private environment file must be owner-only");
  const config = JSON.parse(readFileSync(envPath, "utf8")) as { DATABASE_URL?: string };
  assert.ok(config.DATABASE_URL, "Synthetic database configuration missing");
  if (process.env.DATABASE_URL) assert.equal(process.env.DATABASE_URL, config.DATABASE_URL, "Database identity mismatch");
  const url = new URL(config.DATABASE_URL);
  assert.equal(url.protocol, "postgresql:");
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Only loopback PostgreSQL permitted");
  assert.match(url.pathname, /^\/night_mvp(?:_[a-z0-9_]+)?$/, "Only dedicated Night synthetic database permitted");
  assert.ok(!url.searchParams.has("host"), "No alternate socket host permitted");
  process.env.DATABASE_URL = config.DATABASE_URL;
  const output = process.env.NIGHT_MVP_OUTPUT;
  assert.ok(output && isAbsolute(output), "External evidence directory required");
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const path = realpathSync(output);
  assert.ok(relative(process.cwd(), path).startsWith(".."), "Evidence must remain outside checkout");
  chmodSync(path, 0o700);
  return { output: path, databaseName: url.pathname.slice(1) };
}
export async function loadFixture(): Promise<SyntheticFixture> {
  const { output, databaseName } = isolatedEnvironment();
  const identity = await db().$queryRaw<{ database: string; version: string }[]>`SELECT current_database() AS database, version() AS version`;
  assert.equal(identity[0].database, databaseName);
  assert.match(identity[0].version, /^PostgreSQL /, "Native PostgreSQL required");
  const fixture = JSON.parse(readFileSync(join(output, "fixture.private.json"), "utf8")) as SyntheticFixture;
  const marker = await db().featureFlag.findUniqueOrThrow({ where: { key: "night-mvp-synthetic-fixture" } });
  assert.equal((marker.config as { run?: string }).run, fixture.run, "Synthetic database marker mismatch");
  return fixture;
}
async function seed() {
  const { output, databaseName } = isolatedEnvironment();
  const identity = await db().$queryRaw<{ database: string }[]>`SELECT current_database() AS database`;
  assert.equal(identity[0].database, databaseName);
  assert.equal(existsSync(join(output, "fixture.private.json")), false, "Fixture evidence is non-overwriting; use a new isolated database");
  assert.equal(await db().user.count(), 0, "Initial fixtures require a new empty synthetic database");
  assert.equal(await db().gameSession.count(), 0, "Never populate an existing game database");
  const run = randomUUID();
  const users = await Promise.all(["owner", "other", "admin"].map(kind => db().user.create({ data: {
    email: `night-${kind}-${run}@example.test`, name: kind === "admin" ? "مسؤول اختبار محلي" : "منظم اختبار محلي",
    role: kind === "admin" ? "ADMIN" : "USER",
  } })));
  await db().featureFlag.create({ data: { key: "welcome-credits", enabled: false, config: { count: 0 } } });
  await db().featureFlag.create({ data: { key: "night-mvp-synthetic-fixture", enabled: false, config: { run, purpose: "isolated-synthetic-acceptance-only" } } });
  const initialCredits = 100;
  for (const user of users.slice(0, 2)) await grantAdminCredits(users[2].id, user.email, initialCredits, `night-fixture-${run}-${user.id}`);
  const titles: Record<string, string> = { "top-list": "توب 100", "ordering-challenge": "رتّبها", "survey-show": "قالوا الناس" };
  for (const game of LAUNCH_GAMES) await db().gameType.create({ data: {
    slug: game.slug, title: titles[game.slug] ?? game.slug, description: "سجل لعبة رسمية في قاعدة قبول اصطناعية فقط", enabled: true,
  } });
  const category = await db().category.create({ data: { slug: `night-synthetic-${run}`, title: "محتوى اختبار محلي" } });
  for (let n = 1; n <= 5; n++) {
    const title = `قائمة قبول اصطناعية ${n}`;
    const entries = Array.from({ length: 5 }, (_, i) => ({ rank: i + 1, answer: `عنصر القائمة ${n} رقم ${i + 1}`, alternativeAnswers: [], points: 5 - i, displayValue: null }));
    validateList({ title, entries, kind: "CURATED", description: null, notes: null, sourceLabel: null, sourceUrl: null, sourceDate: null });
    await db().rankedListQuestion.create({ data: { title, normalizedTitle: normalizeRanked(title), kind: "CURATED", difficulty: "EASY", status: "PUBLISHED", categoryId: category.id, entries: { create: entries } } });
  }
  for (let n = 1; n <= 7; n++) {
    const title = `ترتيب قبول اصطناعي ${n}`;
    const items = Array.from({ length: 4 }, (_, i) => ({ label: `عنصر الترتيب ${n} رقم ${i + 1}`, correctPosition: i + 1, acceptedAliases: [], displayValue: null }));
    const question = { title, instruction: "رتّب عناصر الاختبار حسب الأرقام تصاعديًا", difficulty: "EASY" as const, locale: "ar-SA" as const, orderingType: "CUSTOM" as const, factual: false, sourceLabel: null, sourceUrl: null, sourceDate: null, explanation: null };
    validateQuestion({ ...question, category: category.title, items: items.map(i => ({ ...i, id: randomUUID() })) });
    await db().orderingQuestion.create({ data: { ...question, normalizedTitle: normalizeOrdering(title), categoryId: category.id, status: "PUBLISHED", items: { create: items } } });
  }
  for (let n = 1; n <= 5; n++) {
    const answers = Array.from({ length: 3 }, (_, i) => ({ answer: `إجابة استطلاع ${n} رقم ${i + 1}`, alternativeAnswers: [], points: [50, 30, 20][i], position: i }));
    assert.ok(validateAnswers(answers));
    await db().surveyQuestion.create({ data: { question: `سؤال قبول اصطناعي ${n}؟`, categoryId: category.id, difficulty: "EASY", status: "PUBLISHED", sourceType: "CURATED", answers: { create: answers } } });
  }
  const credential = async (userId: string) => { const token = newToken(); await db().authSession.create({ data: { userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 86400_000) } }); return token; };
  const fixture: SyntheticFixture = { run, ownerId: users[0].id, otherOwnerId: users[1].id, adminId: users[2].id, ownerToken: await credential(users[0].id), otherOwnerToken: await credential(users[1].id), initialCredits };
  writeFileSync(join(output, "fixture.private.json"), JSON.stringify(fixture), { mode: 0o600, flag: "wx" });
  writeFileSync(join(output, "fixture-summary.json"), JSON.stringify({ syntheticOnly: true, nativePostgres: true, officialGamesRegistered: LAUNCH_GAMES.length, rankedLists: 5, orderingQuestions: 7, surveys: 5, accounts: 3, initialCreditsPerOwner: initialCredits, canonicalAdminGrant: true, noMerchantOrCustomerData: true }), { mode: 0o600, flag: "wx" });
  console.log("Synthetic Night fixtures created; all identities, credentials and answers withheld.");
}
if (process.argv.includes("--seed")) seed().catch(() => { console.error("Synthetic fixture creation failed; private values withheld."); process.exitCode = 1; }).finally(() => db().$disconnect());
