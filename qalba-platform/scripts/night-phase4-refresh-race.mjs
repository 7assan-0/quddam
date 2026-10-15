/** Real Chrome organizer-refresh race regression. Synthetic loopback fixture only.
 * The first real GET response is held while a real RSVP commits. The fixed UI
 * permits only one manual refresh in flight, then reads the new count normally.
 * A dropped subsequent GET must unlock the button and permit a successful retry.
 * No fabricated responses, game START, results, credit writes, or external APIs.
 * Set NIGHT_PHASE4_REPRODUCE_REFRESH_RACE=1 only to reproduce the predecessor UI.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { chromium, expect } from "@playwright/test";
import { Pool } from "pg";

assert.equal(process.env.NIGHT_MVP_SYNTHETIC, "1");
assert.notEqual(process.env.NODE_ENV, "production");
const envFile = realpathSync(process.env.NIGHT_MVP_ENV_FILE ?? "");
assert.equal(statSync(envFile).mode & 0o077, 0);
assert.ok(relative(process.cwd(), envFile).startsWith(".."));
const config = JSON.parse(readFileSync(envFile, "utf8"));
const database = new URL(config.DATABASE_URL);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(database.hostname));
assert.match(database.pathname, /^\/night_mvp(?:_[a-z0-9_]+)?$/);
assert.equal(database.searchParams.has("host"), false);
const origin = new URL(process.env.BASE_URL ?? "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname));
assert.equal(origin.pathname, "/");
const output = realpathSync(process.env.NIGHT_MVP_OUTPUT ?? "");
assert.ok(isAbsolute(output) && relative(process.cwd(), output).startsWith(".."));
const fixtureFile = join(output, "fixture.private.json");
assert.equal(statSync(fixtureFile).mode & 0o077, 0);
const fixture = JSON.parse(readFileSync(fixtureFile, "utf8"));
const run = process.env.NIGHT_PHASE4_RUN ?? "phase4-refresh-race";
assert.match(run, /^[A-Za-z0-9_-]+$/);
const evidence = join(output, run);
mkdirSync(evidence, { mode: 0o700 }); // Refuse to overwrite earlier evidence.
const executable = process.env.CHROME_EXECUTABLE;
assert.ok(executable && isAbsolute(executable));
const version = execFileSync(executable, ["--version"], { encoding: "utf8" }).trim();
assert.match(version, /^Google Chrome/);
const pool = new Pool({ connectionString: config.DATABASE_URL, max: 1 });
const identity = await pool.query("SELECT current_database() AS database, version() AS version");
assert.equal(identity.rows[0].database, database.pathname.slice(1));
assert.match(identity.rows[0].version, /^PostgreSQL 17\./);
const marker = await pool.query('SELECT "config" FROM "FeatureFlag" WHERE "key"=$1', ["night-mvp-synthetic-fixture"]);
assert.equal(marker.rows[0].config.run, fixture.run);
const declaredServerHead = process.env.NIGHT_PHASE4_SERVER_HEAD ?? null;
if (declaredServerHead !== null) assert.match(declaredServerHead, /^[a-f0-9]{40}$/);
const receipt = {
  schemaVersion: 1, sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceDirty: execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim().length > 0,
  browser: version, syntheticOnly: true, localhostOnly: true, realHttp: true, nativePostgres: true,
  fabricatedResponses: false, status: "FAILED", phase: "start", ownerRefreshGets: 0, checks: [],
  // The test runner's checkout identity alone cannot identify an older server build.
  serverArtifactHeadDeclaredByOperator: declaredServerHead,
};
let browser, release, releaseDelivered, responseHeld = false;
function bounded(promise) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Controlled response deadline exceeded")), 15_000);
  })]).finally(() => clearTimeout(timer));
}
const check = (name, condition = true) => { assert.ok(condition, name); receipt.checks.push({ name, passed: true }); };
try {
  browser = await chromium.launch({ executablePath: executable, headless: true,
    ...(process.env.NIGHT_MVP_CHROME_NO_SANDBOX === "1" ? { args: ["--no-sandbox"] } : {}) });
  const owner = await browser.newContext({ timezoneId: "Asia/Riyadh" });
  await owner.addCookies([{ name: "qalba_session", value: fixture.ownerToken, url: origin.origin, httpOnly: true, sameSite: "Lax" }]);
  const initialBalance = (await pool.query('SELECT "balance" FROM "CreditWallet" WHERE "userId"=$1', [fixture.ownerId])).rows[0].balance;
  receipt.phase = "create-synthetic-night";
  const created = await owner.request.post(new URL("/api/night", origin).href, { headers: { Origin: origin.origin }, data: {
    key: crypto.randomUUID(), games: ["top-list", "ordering-challenge", "survey-show"], teams: ["فريق تحديث أول", "فريق تحديث ثان"],
  } });
  assert.equal(created.status(), 201); const night = (await created.json()).night;
  const invitation = await owner.request.post(new URL(`/api/night/${night.id}/invitation`, origin).href,
    { headers: { Origin: origin.origin }, data: { scheduledAt: new Date(Date.now() + 3_600_000).toISOString(), timezone: "Asia/Riyadh" } });
  assert.equal(invitation.status(), 201); const path = (await invitation.json()).invitation.path;
  const guest = await browser.newContext();
  const guestApi = path.replace("/night/invite/", "/api/night/invite/");
  assert.equal((await guest.request.get(new URL(guestApi, origin).href)).status(), 200);
  const page = await owner.newPage(); await page.goto(new URL(`/night/${night.id}`, origin).href);
  const refresh = page.getByRole("button", { name: "تحديث الحضور والتصويت", exact: true });
  await expect(refresh).toBeVisible();
  const count = async () => Number(/قالوا جاي:\s*(\d+)/.exec(await page.locator("p").filter({ hasText: "قالوا جاي:" }).innerText())?.[1]);
  assert.equal(await count(), 0);
  let firstSnapshot, olderDelivered, abortNext = false;
  const firstReady = new Promise(resolve => { firstSnapshot = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const olderDone = new Promise(resolve => { olderDelivered = resolve; });
  releaseDelivered = olderDone;
  await page.route(url => url.pathname === `/api/night/${night.id}/invitation`, async route => {
    if (route.request().method() !== "GET") return route.continue();
    receipt.ownerRefreshGets++;
    if (abortNext) { abortNext = false; return route.abort("connectionreset"); }
    const response = await route.fetch();
    if (receipt.ownerRefreshGets === 1) {
      responseHeld = true; firstSnapshot(); await held;
      try { await route.fulfill({ response }); } finally { olderDelivered(); }
    }
    else await route.fulfill({ response });
  });
  receipt.phase = "hold-older-real-snapshot";
  await refresh.click(); await bounded(firstReady);
  const reply = await guest.request.post(new URL(guestApi, origin).href, { headers: { Origin: origin.origin },
    data: { name: "ضيف تحديث اصطناعي", rsvp: "YES", gameVote: "top-list" } });
  assert.equal(reply.status(), 200); check("real-rsvp-committed-while-owner-snapshot-held");
  receipt.buttonDisabledWhileRefreshing = await refresh.isDisabled();
  if (process.env.NIGHT_PHASE4_REPRODUCE_REFRESH_RACE === "1") {
    assert.equal(receipt.buttonDisabledWhileRefreshing, false);
    await refresh.click(); await expect.poll(count).toBe(1); receipt.newerVisibleComing = await count();
    release(); await bounded(olderDone); await expect.poll(count).toBe(0); receipt.olderVisibleComingAfterward = await count();
    receipt.status = "REPRODUCED";
  } else {
    check("refresh-disabled-during-pending-response", receipt.buttonDisabledWhileRefreshing);
    // Even a synthetic rapid DOM click cannot launch another refresh while disabled.
    await refresh.evaluate(button => button.click());
    check("one-request-in-flight", receipt.ownerRefreshGets === 1);
    release(); await bounded(olderDone); await expect(refresh).toBeEnabled();
    receipt.phase = "ordinary-refresh-reads-new-snapshot";
    await refresh.click(); await expect.poll(count).toBe(1); await expect(refresh).toBeEnabled();
    check("ordinary-refresh-shows-committed-attendance", await count() === 1);
    receipt.phase = "network-failure-unlocks-retry";
    abortNext = true; await refresh.click();
    await expect(page.getByRole("status").filter({ hasText: "تعذر تحديث الدعوة حاليًا." })).toBeVisible();
    await expect(refresh).toBeEnabled(); check("failed-refresh-unlocks-button");
    await refresh.click(); await expect(page.getByRole("status").filter({ hasText: "تم تحديث الحضور والتصويت." })).toBeVisible();
    await expect(refresh).toBeEnabled(); check("retry-after-network-failure-succeeds", await count() === 1);
    const finalBalance = (await pool.query('SELECT "balance" FROM "CreditWallet" WHERE "userId"=$1', [fixture.ownerId])).rows[0].balance;
    check("no-credit-debit", initialBalance === finalBalance);
    const sources = await pool.query('SELECT COUNT(*)::int AS count FROM "NightGame" WHERE "nightId"=$1 AND "sourceSessionId" IS NOT NULL', [night.id]);
    check("no-game-session-created", sources.rows[0].count === 0);
    receipt.finalVisibleComing = await count(); receipt.status = "PASSED";
  }
  receipt.phase = "complete";
} catch { receipt.status = "FAILED"; }
finally {
  release?.();
  if (responseHeld) await bounded(releaseDelivered).catch(() => {});
  await browser?.close(); await pool.end(); receipt.finishedAt = new Date().toISOString();
  receipt.passed = receipt.checks.length; receipt.failed = receipt.status === "FAILED" ? 1 : 0;
  writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2), { mode: 0o600, flag: "wx" });
}
console.log(JSON.stringify(receipt));
process.exitCode = receipt.status === "FAILED" ? 1 : 0;
