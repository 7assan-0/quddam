/** Phase 4 actual Chrome acceptance, extending the canonical engine UI journey.
 * Real HTTP, native PostgreSQL; no request mocks or fabricated game results.
 * Required: NIGHT_MVP_SYNTHETIC=1, NIGHT_MVP_ENV_FILE, NIGHT_MVP_OUTPUT,
 * BASE_URL (loopback), CHROME_EXECUTABLE. Run only against the isolated fixture DB.
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
assert.ok(!database.searchParams.has("host"));
const origin = new URL(process.env.BASE_URL ?? "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname));
assert.equal(origin.pathname, "/");
const output = process.env.NIGHT_MVP_OUTPUT;
assert.ok(output && isAbsolute(output));
assert.ok(relative(process.cwd(), realpathSync(output)).startsWith(".."));
const fixture = JSON.parse(readFileSync(join(output, "fixture.private.json"), "utf8"));
const evidence = join(output, process.env.NIGHT_PHASE4_RUN ?? "phase4-chrome");
mkdirSync(evidence, { mode: 0o700 }); // Refuse to overwrite prior evidence.
const executablePath = process.env.CHROME_EXECUTABLE;
assert.ok(executablePath && isAbsolute(executablePath));
const chromeVersion = execFileSync(executablePath, ["--version"], { encoding: "utf8" }).trim();
assert.match(chromeVersion, /^Google Chrome/);
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const pool = new Pool({ connectionString: config.DATABASE_URL, max: 2 });
const identity = await pool.query("SELECT current_database() AS database, version() AS version");
assert.equal(identity.rows[0].database, database.pathname.slice(1));
assert.match(identity.rows[0].version, /^PostgreSQL /);
const marker = await pool.query('SELECT "config" FROM "FeatureFlag" WHERE "key"=$1', ["night-mvp-synthetic-fixture"]);
assert.equal(marker.rows[0].config.run, fixture.run);

const result = {
  schemaVersion: 1, sourceHead, sourceDirty: execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim().length > 0, browser: chromeVersion, headless: true,
  localhostOnly: true, syntheticOnly: true, realHttp: true, nativePostgres: true,
  mocks: false, startedAt: new Date().toISOString(), checks: [], games: [],
  errors: { pageExceptions: 0, consoleErrors: 0, consoleErrorCategories: {}, failedRequests: 0, failedRequestCategories: {}, externalBrowserRequests: 0 },
};
let browser, activePage, step = "launch";
function check(name, value = true) { assert.ok(value, name); result.checks.push({ name, passed: true }); }
function checkpoint() { writeFileSync(join(evidence, "progress.json"), JSON.stringify({ ...result, currentStep: step }), { mode: 0o600 }); }
function observePage(page) {
  page.on("pageerror", () => result.errors.pageExceptions++);
  page.on("console", message => {
    if (message.type() !== "error") return;
    result.errors.consoleErrors++;
    const text = message.text();
    const status = text.match(/Failed to load resource:.*status of (\d{3})/i)?.[1];
    const category = status ? `http-${status}` : /hydration|Minified React error #(?:418|423|425)/i.test(text) ? "hydration" : "other-redacted";
    result.errors.consoleErrorCategories[category] = (result.errors.consoleErrorCategories[category] ?? 0) + 1;
  });
  page.on("request", request => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== origin.origin) result.errors.externalBrowserRequests++;
  });
  page.on("requestfailed", request => {
    result.errors.failedRequests++;
    const reported = request.failure()?.errorText ?? "UNKNOWN";
    const code = /^net::ERR_[A-Z_]+$/.test(reported) ? reported : "OTHER_REDACTED";
    const pathname = new URL(request.url()).pathname;
    const eventStream = pathname.endsWith("/events");
    const scope = request.headers()["rsc"] === "1" ? "next-rsc-prefetch" : pathname.startsWith("/api/night/") ? "night-api" : pathname.startsWith("/night/") ? "night-page" : pathname.startsWith("/_next/") ? "next-internal" : "other";
    const classification = eventStream && code === "net::ERR_ABORTED" ? "event-stream-navigation-abort" : "other-request-failure";
    const key = `${scope}:${classification}:${request.method()}:${request.resourceType()}:${code}`;
    result.errors.failedRequestCategories[key] = (result.errors.failedRequestCategories[key] ?? 0) + 1;
  });
}
const sql = async (query, values = []) => (await pool.query(query, values)).rows;
async function wallet() { return (await sql('SELECT "balance" FROM "CreditWallet" WHERE "userId"=$1', [fixture.ownerId]))[0].balance; }
// Chrome accepts Secure cookies on the trustworthy loopback origin; Playwright's
// separate Node APIRequestContext does not. Owner HTTP checks use the signed-in
// browser's fetch so they exercise the real login cookie without weakening it.
function browserHttp(page) {
  const send = async (url, options = {}) => {
    const value = await page.evaluate(async ({ url, options }) => {
      const response = await fetch(url, { method: options.method ?? "GET", credentials: "same-origin", cache: "no-store",
        headers: { ...(options.data ? { "Content-Type": "application/json" } : {}), ...options.headers },
        ...(options.data ? { body: JSON.stringify(options.data) } : {}) });
      const headers = Object.fromEntries(response.headers);
      return { status: response.status, headers, body: headers["content-type"]?.includes("application/json") ? await response.json() : null };
    }, { url, options });
    return { status: () => value.status, headers: () => value.headers, json: async () => value.body };
  };
  return { get: (url, options) => send(url, options), post: (url, options) => send(url, { ...options, method: "POST" }) };
}
async function nightRead(page, id) { const r = await browserHttp(page).get(new URL(`/api/night/${id}`, origin).href); assert.equal(r.status(), 200); return (await r.json()).night; }
async function sourceRead(page, path, id) { const r = await browserHttp(page).get(new URL(`/api/${path}/${id}`, origin).href); assert.equal(r.status(), 200); return r.json(); }
async function clickMutation(page, button, suffix, expectedStatus = 200) {
  await expect(button).toBeEnabled();
  const pending = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith(suffix));
  await button.click();
  const response = await pending;
  assert.equal(response.status(), expectedStatus, `Canonical UI command rejected at ${step}`);
  return response.json();
}
async function clickGame(page, label, path, id) {
  const data = await clickMutation(page, page.getByRole("button", { name: label, exact: true }), `/api/${path}/${id}/commands`);
  const view = data.session;
  await expect(page.locator(`.${path === "survey-show" ? "survey" : path}-host`)).toHaveAttribute("data-phase", view.phase);
  return view;
}
async function captureNight(page, name) {
  await page.getByTestId("night-dashboard").screenshot({ path: join(evidence, `${name}.png`) });
}
async function canonicalCompleted(id, module, rounds, expectedScores) {
  const rows = await sql('SELECT "status","state","creditConsumedAt" FROM "GameSession" WHERE "id"=$1', [id]);
  assert.equal(rows[0].status, "COMPLETED");
  assert.equal(rows[0].state.module, module);
  assert.equal(rows[0].state.phase, "COMPLETED");
  assert.ok(rows[0].creditConsumedAt);
  assert.deepEqual(rows[0].state.scores, expectedScores);
  if (module !== "SURVEY_BATTLE") assert.equal(rows[0].state.results.length, rounds);
  else {
    const awards = await sql('SELECT count(*)::int AS n FROM "GameCommand" WHERE "sessionId"=$1 AND "type"=$2', [id, "AWARD_ROUND"]);
    assert.equal(awards[0].n, rounds);
  }
  const debit = await sql('SELECT count(*)::int AS n FROM "GameCredit" WHERE "userId"=$1 AND "idempotencyKey"=$2 AND "delta"=-1', [fixture.ownerId, `game-start:${id}`]);
  assert.equal(debit[0].n, 1);
  result.games.push({ engine: module, roundsActuallyPlayed: rounds, rawScores: expectedScores, status: "COMPLETED", exactlyOneCanonicalStartDebit: true });
}
async function playRanked(page, id) {
  step = "ranked-start"; checkpoint();
  await expect(page.locator(".ranked-host")).toHaveAttribute("data-live-ready", "true");
  await clickGame(page, "ابدأ المباراة", "ranked", id);
  const expectedScores = [0, 0];
  for (let round = 0; round < 5; round++) {
    step = `ranked-round-${round + 1}`; checkpoint();
    await clickGame(page, "ابدأ الجولة", "ranked", id);
    const use = (await sql('SELECT "snapshot" FROM "RankedListUse" WHERE "sessionId"=$1 AND "matchNumber"=1 AND "roundIndex"=$2', [id, round]))[0].snapshot;
    for (const [index, entry] of use.entries.entries()) {
      await page.getByLabel("تخمين الفريق الحالي", { exact: true }).fill(entry.answer);
      const data = await clickMutation(page, page.getByRole("button", { name: "أرسل التخمين", exact: true }), `/api/ranked/${id}/commands`);
      expectedScores[(round + index) % 2] += entry.points;
      assert.deepEqual(data.session.teams.map(t => t.score), expectedScores);
      await expect(page.locator(`[data-rank="${entry.rank}"]`)).toHaveAttribute("data-revealed", "true");
      await expect(page.getByLabel("تخمين الفريق الحالي", { exact: true })).toHaveCount(index === use.entries.length - 1 ? 0 : 1);
    }
    await clickGame(page, round === 4 ? "النتيجة النهائية" : "الجولة التالية", "ranked", id);
  }
  await clickGame(page, "أكمل المباراة", "ranked", id);
  await canonicalCompleted(id, "RANKED_LIST", 5, expectedScores);
}
async function reorder(page, desired) {
  const editor = page.locator(".ordering-editor");
  for (let target = 0; target < desired.length; target++) {
    for (;;) {
      const order = await editor.locator("li").evaluateAll(rows => rows.map(row => row.getAttribute("data-item-id")));
      const index = order.indexOf(desired[target]);
      assert.ok(index >= target);
      if (index === target) break;
      const item = editor.locator("li").nth(index);
      const pending = page.waitForResponse(r => r.request().method() === "POST" && /\/api\/ordering\/[^/]+\/controller$/.test(new URL(r.url()).pathname));
      await item.getByRole("button", { name: /للأعلى$/ }).click();
      assert.equal((await pending).status(), 200);
      await expect(editor.locator("li").nth(index - 1)).toHaveAttribute("data-item-id", desired[target]);
    }
  }
  assert.deepEqual(await editor.locator("li").evaluateAll(rows => rows.map(row => row.getAttribute("data-item-id"))), desired);
}
async function playOrdering(page, id) {
  step = "ordering-start"; checkpoint();
  await expect(page.locator(".ordering-host")).toHaveAttribute("data-live-ready", "true");
  await clickGame(page, "ابدأ المباراة", "ordering", id);
  const phones = [];
  try {
    for (const team of ["A", "B"]) {
      await page.getByRole("button", { name: `إنشاء ترتيب ${team}`, exact: true }).click();
      const link = page.getByRole("link", { name: `افتح ترتيب ${team}`, exact: true });
      await expect(link).toBeVisible();
      const url = new URL(await link.getAttribute("href"), origin);
      assert.equal(url.origin, origin.origin);
      const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
      const phone = await context.newPage();
      observePage(phone);
      await phone.goto(url.href);
      await expect(phone.locator(".ordering-phone")).toHaveAttribute("data-live-ready", "true");
      check(`ordering-controller-${team}-has-no-host-controls`, await phone.getByRole("button", { name: "ابدأ المباراة", exact: true }).count() === 0);
      phones.push({ context, page: phone });
    }
    await clickGame(page, "ابدأ الجولة", "ordering", id);
    for (let round = 0; round < 7; round++) {
      step = `ordering-round-${round + 1}`; checkpoint();
      const q = (await sql('SELECT "snapshot" FROM "OrderingQuestionUse" WHERE "sessionId"=$1 AND "matchNumber"=1 AND "roundIndex"=$2', [id, round]))[0].snapshot;
      const correct = [...q.items].sort((a, b) => a.correctPosition - b.correctPosition).map(i => i.id);
      for (const [team, phone] of phones.entries()) {
        await expect(phone.page.locator(".ordering-phone")).toHaveAttribute("data-phase", "ORDERING");
        await expect(phone.page.locator(".ordering-editor li")).toHaveCount(4);
        await reorder(phone.page, team === 0 ? correct : [...correct].reverse());
        const response = await clickMutation(phone.page, phone.page.getByRole("button", { name: "سلّم الترتيب", exact: true }), `/api/ordering/${id}/controller`);
        assert.equal(response.session.submitted[team], true);
      }
      await expect(page.locator(".ordering-host")).toHaveAttribute("data-phase", "REVEAL");
      await clickGame(page, "نتيجة الجولة", "ordering", id);
      await clickGame(page, round === 6 ? "النتيجة النهائية" : "الجولة التالية", "ordering", id);
    }
    await clickGame(page, "أكمل المباراة", "ordering", id);
    await canonicalCompleted(id, "ORDERING", 7, [70, 0]);
  } finally { await Promise.all(phones.map(p => p.context.close())); }
}
async function playSurvey(page, id) {
  step = "survey-start"; checkpoint();
  await expect(page.locator(".survey-host")).toHaveAttribute("data-live-ready", "true");
  await clickGame(page, "ابدأ اللعبة", "survey-show", id);
  for (let round = 0; round < 5; round++) {
    step = `survey-round-${round + 1}`; checkpoint();
    await clickGame(page, "ابدأ المواجهة", "survey-show", id);
    const view = await sourceRead(page, "survey-show", id);
    step = `survey-round-${round + 1}-face-team-a`; checkpoint();
    await page.getByLabel("الفريق في المواجهة").selectOption("0");
    step = `survey-round-${round + 1}-face-answer`; checkpoint();
    await page.getByLabel("تأكيد الإجابة").selectOption(view.answers[0].id);
    await clickGame(page, "كشف الإجابة", "survey-show", id);
    step = `survey-round-${round + 1}-face-team-b`; checkpoint();
    await page.getByLabel("الفريق في المواجهة").selectOption("1");
    await clickGame(page, "إجابة خاطئة", "survey-show", id);
    await clickGame(page, "ابدأ إجابات الفريق", "survey-show", id);
    for (const [index, answer] of view.answers.slice(1).entries()) {
      step = `survey-round-${round + 1}-answer-${index + 2}`; checkpoint();
      await page.getByLabel("تأكيد الإجابة").selectOption(answer.id);
      await clickGame(page, "كشف الإجابة", "survey-show", id);
    }
    await clickGame(page, "امنح نقاط الجولة", "survey-show", id);
    await clickGame(page, round === 4 ? "النتيجة النهائية" : "الجولة التالية", "survey-show", id);
  }
  await clickGame(page, "أكمل المباراة", "survey-show", id);
  await canonicalCompleted(id, "SURVEY_BATTLE", 5, [900, 0]);
}
try {
  const sandboxDisabled = process.env.NIGHT_MVP_CHROME_NO_SANDBOX === "1";
  result.sandboxDisabled = sandboxDisabled;
  browser = await chromium.launch({ executablePath, headless: true, ...(sandboxDisabled ? { args: ["--no-sandbox"] } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Riyadh", permissions: ["clipboard-read", "clipboard-write"] });
  const login = JSON.parse(readFileSync(join(output, "phase4-auth.private.json"), "utf8"));
  const page = await context.newPage();
  activePage = page;
  observePage(page);
  step = "organizer-real-login-ui"; checkpoint();
  await page.goto(new URL("/login", origin).href);
  await page.locator("#email").fill(login.email);
  await page.locator("#password").fill(login.password);
  const loggedIn = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/auth/login");
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  assert.equal((await loggedIn).status(), 200);
  await expect.poll(async () => (await context.cookies()).some(cookie => cookie.name === "qalba_session" && cookie.httpOnly)).toBe(true);
  check("organizer-signed-in-through-real-login-ui-with-synthetic-account");
  const before = await wallet();
  step = "library-night-entry"; checkpoint();
  await page.goto(new URL("/games", origin).href);
  step = "library-ten-official-games"; checkpoint();
  await expect(page.getByRole("article")).toHaveCount(10);
  step = "night-home-navigation"; checkpoint();
  await page.locator(".library-balance").getByRole("link", { name: "ليلة قدّام", exact: true }).click();
  await expect(page.getByTestId("night-home")).toBeVisible();
  step = "night-setup-navigation"; checkpoint();
  await page.getByRole("link", { name: /إنشاء|سهرة جديدة/ }).click();
  await expect(page.getByTestId("night-setup")).toBeVisible();
  await page.getByTestId("night-team-a").fill("فريق السهرة الأول");
  await page.getByTestId("night-team-b").fill("فريق السهرة الثاني");
  const gameOrder = page.getByTestId("night-game-order").locator("li");
  await page.getByRole("button", { name: "أخّر توب 100 في ترتيب السهرة", exact: true }).click();
  assert.deepEqual(await gameOrder.evaluateAll(rows => rows.map(row => row.getAttribute("data-game"))), ["ordering-challenge", "top-list", "survey-show"]);
  await page.getByRole("button", { name: "قدّم توب 100 في ترتيب السهرة", exact: true }).click();
  check("game-order-buttons-change-and-restore-the-actual-order");
  const selected = await page.getByTestId("night-game-order").locator("li").evaluateAll(rows => rows.map(row => row.getAttribute("data-game")));
  assert.deepEqual(selected, ["top-list", "ordering-challenge", "survey-show"]);
  const created = await clickMutation(page, page.getByTestId("night-create"), "/api/night", 201);
  const id = created.night.id;
  writeFileSync(join(evidence, "journey.private.json"), JSON.stringify({ nightId: id, ownerId: fixture.ownerId }), { mode: 0o600, flag: "wx" });
  await expect(page.getByTestId("night-dashboard")).toHaveAttribute("data-phase", "preparing");
  check("night-create-no-debit", await wallet() === before);
  check("no-champion-before-games", await page.getByTestId("night-champion").count() === 0);
  step = "organizer-creates-future-invitation-through-ui"; checkpoint();
  const invitationPanel = page.getByTestId("night-invitation-setup");
  await expect(invitationPanel).toBeVisible();
  const futureLocal = await page.evaluate(() => {
    const future = new Date(Date.now() + 3600_000);
    const pad = n => String(n).padStart(2, "0");
    return `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
  });
  await page.locator("#night-invite-time").fill(futureLocal);
  const invitationCreated = await clickMutation(page, page.getByRole("button", { name: "أنشئ رابط الدعوة", exact: true }), `/api/night/${id}/invitation`, 201);
  const invitationPath = invitationCreated.invitation.path;
  writeFileSync(join(evidence, "invitation.private.json"), JSON.stringify({ path: invitationPath }), { mode: 0o600, flag: "wx" });
  const inviteUrl = new URL(invitationPath, origin);
  assert.equal(inviteUrl.origin, origin.origin);
  await expect(page.locator("#night-invite-link")).toHaveValue(inviteUrl.href);
  await page.getByRole("button", { name: "نسخ رابط الدعوة", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(inviteUrl.href);
  check("organizer-created-and-copied-one-time-invitation-link-in-ui");
  check("invitation-ui-did-not-start-source-game-or-charge-credit", await wallet() === before);
  const guest = await browser.newContext({ viewport: { width: 430, height: 932 }, timezoneId: "Asia/Riyadh" });
  const guestPage = await guest.newPage(); observePage(guestPage);
  const guestDocument = await guestPage.goto(inviteUrl.href);
  check("invitation-page-privacy-no-referrer-noindex-no-store", guestDocument.headers()["referrer-policy"] === "no-referrer" && guestDocument.headers()["cache-control"].includes("no-store") && guestDocument.headers()["x-robots-tag"].includes("noindex"));
  await expect(guestPage.getByTestId("night-public-invitation")).toBeVisible();
  const guestName = guestPage.getByLabel("اسمك في الدعوة (بدون بيانات شخصية)", { exact: true });
  await guestName.fill("زائر رحلة اصطناعي");
  await guestPage.getByRole("radio", { name: "جاي", exact: true }).check();
  await guestPage.getByRole("radio", { name: "توب 100", exact: true }).check();
  let guestReply = await clickMutation(guestPage, guestPage.getByRole("button", { name: "تأكيد ردي", exact: true }), invitationPath.replace("/night/invite/", "/api/night/invite/"));
  assert.equal(guestReply.invitation.coming, 1); assert.equal(guestReply.invitation.games.find(x => x.game === "top-list").votes, 1);
  check("anonymous-guest-confirmed-yes-and-ballot-through-real-ui");
  await guestPage.reload(); await expect(guestName).toHaveValue("زائر رحلة اصطناعي");
  await expect(guestName).not.toBeEditable();
  await expect(guestPage.getByRole("radio", { name: "توب 100", exact: true })).toBeChecked();
  check("anonymous-reload-restores-own-response-from-httponly-cookie");
  await guestPage.getByRole("radio", { name: "قالوا الناس", exact: true }).check();
  guestReply = await clickMutation(guestPage, guestPage.getByRole("button", { name: "تحديث ردي وتصويتي", exact: true }), invitationPath.replace("/night/invite/", "/api/night/invite/"));
  assert.equal(guestReply.invitation.coming, 1); assert.equal(guestReply.invitation.games.find(x => x.game === "top-list").votes, 0);
  assert.equal(guestReply.invitation.games.find(x => x.game === "survey-show").votes, 1);
  check("ui-ballot-change-replaces-old-vote-without-duplicate-attendance");
  await page.getByRole("button", { name: "تحديث الحضور والتصويت", exact: true }).click();
  await expect(invitationPanel).toContainText("قالوا جاي: 1");
  await expect(invitationPanel).toContainText("قالوا الناس: 1 صوت");
  check("organizer-ui-shows-real-attendance-and-advisory-ballot-aggregates");
  await guestPage.getByRole("radio", { name: "مو جاي", exact: true }).check();
  guestReply = await clickMutation(guestPage, guestPage.getByRole("button", { name: "تحديث ردي وتصويتي", exact: true }), invitationPath.replace("/night/invite/", "/api/night/invite/"));
  assert.equal(guestReply.invitation.coming, 0); assert.equal(guestReply.invitation.declined, 1);
  assert.ok(guestReply.invitation.games.every(x => x.votes === 0));
  check("ui-decline-clears-ballot-with-one-response-preserved");
  const separateGuest = await browser.newContext();
  const strangerPublic = await separateGuest.request.get(new URL(invitationPath.replace("/night/invite/", "/api/night/invite/"), origin).href);
  const strangerView = (await strangerPublic.json()).invitation;
  assert.equal(strangerView.mine, null); assert.doesNotMatch(JSON.stringify(strangerView), /زائر رحلة اصطناعي|capabilityHash|ownerId|sourceSessionId|tokenHash/);
  check("public-projection-hides-other-guests-alias-and-all-management-authority");
  const guestManagement = await guest.request.post(new URL(`/api/night/${id}/commands`, origin).href, { headers: { Origin: origin.origin }, data: { key: crypto.randomUUID(), expectedVersion: created.night.version, op: "START" } });
  check("rsvp-cookie-does-not-authorize-night-or-game-management", guestManagement.status() === 401);
  const malicious = await guest.request.post(new URL(invitationPath.replace("/night/invite/", "/api/night/invite/"), origin).href, { headers: { Origin: "https://untrusted.example.test" }, data: { name: "مرفوض", rsvp: "YES", gameVote: null } });
  const forged = await guest.request.post(new URL(invitationPath.replace("/night/invite/", "/api/night/invite/"), origin).href, { headers: { Origin: origin.origin }, data: { name: "مرفوض", rsvp: "YES", gameVote: null, host: true } });
  check("actual-http-rejects-cross-origin-and-extra-host-field", malicious.status() === 403 && forged.status() === 400);
  step = "owner-precompletion-share-card-status"; checkpoint();
  const beforeComplete = await browserHttp(page).get(new URL(`/api/night/${id}/share-card`, origin).href);
  result.precompletionCardStatus = beforeComplete.status();
  check("actual-http-no-champion-card-before-all-games-completed", beforeComplete.status() === 409);
  await separateGuest.close();
  writeFileSync(join(evidence, "guest-cookies.private.json"), JSON.stringify(await guest.cookies()), { mode: "0600", flag: "wx" });
  await guest.close();
  step = "owner-refresh-hides-secret"; checkpoint();
  await page.reload(); await expect(invitationPanel).toBeVisible();
  await expect(page.locator("#night-invite-link")).toHaveCount(0);
  check("organizer-refresh-does-not-reveal-secret-invitation-again");

  const validInput = { key: crypto.randomUUID(), games: selected, teams: ["فريق السهرة الأول", "فريق السهرة الثاني"] };
  const injected = await browserHttp(page).post(new URL("/api/night", origin).href, { headers: { Origin: origin.origin }, data: { ...validInput, totals: { forged: 999 } } });
  check("http-rejects-browser-supplied-night-points", injected.status() === 400);
  const wrongOrigin = await page.request.post(new URL("/api/night", origin).href, { headers: { Origin: "https://untrusted.example.test" }, data: validInput });
  result.crossOriginCreationStatus = wrongOrigin.status();
  check("http-rejects-cross-origin-night-creation", wrongOrigin.status() === 403);
  step = "other-owner-access-control"; checkpoint();
  const other = await browser.newContext();
  await other.addCookies([{ name: "qalba_session", value: fixture.otherOwnerToken, url: origin.origin, httpOnly: true, sameSite: "Lax" }]);
  const otherRead = await other.request.get(new URL(`/api/night/${id}`, origin).href);
  const otherCommand = await other.request.post(new URL(`/api/night/${id}/commands`, origin).href, { headers: { Origin: origin.origin }, data: { key: crypto.randomUUID(), expectedVersion: created.night.version, op: "START" } });
  check("http-other-authenticated-owner-cannot-read-or-command-night", otherRead.status() === 404 && otherCommand.status() === 404);
  for (const suffix of ["invitation", "highlights", "share-card"]) {
    const denied = await other.request.get(new URL(`/api/night/${id}/${suffix}`, origin).href);
    check(`other-authenticated-owner-cannot-read-${suffix}`, denied.status() === 404);
  }
  await other.close();
  check("rejected-http-input-has-no-financial-effect", await wallet() === before);
  await captureNight(page, "01-preparing");
  await clickMutation(page, page.getByTestId("night-start"), `/api/night/${id}/commands`);
  await expect(page.getByTestId("night-dashboard")).toHaveAttribute("data-phase", "playing");
  check("night-start-no-debit", await wallet() === before);
  for (const [index, game] of ["top-list", "ordering-challenge", "survey-show"].entries()) {
    step = `night-open-game-${index + 1}`; checkpoint();
    const night = await nightRead(page, id);
    assert.equal(night.current.game, game);
    assert.equal(night.currentIndex, index);
    const href = await page.getByTestId("night-source-link").getAttribute("href");
    assert.equal(href, night.current.hostHref);
    const sourceId = href.split("/").at(-1);
    await page.getByTestId("night-source-link").click();
    await expect(page).toHaveURL(new URL(href, origin).href);
    if (game === "top-list") await playRanked(page, sourceId);
    else if (game === "ordering-challenge") await playOrdering(page, sourceId);
    else await playSurvey(page, sourceId);
    step = `night-automatic-import-${index + 1}`; checkpoint();
    await expect(page.getByTestId("night-return-link")).toHaveAttribute("href", `/night/${id}`);
    await page.getByTestId("night-return-link").click();
    await expect.poll(async () => (await nightRead(page, id)).results.length, { timeout: 30_000 }).toBe(index + 1);
    const imported = await nightRead(page, id);
    assert.deepEqual(imported.teams.map(t => t.name), ["فريق السهرة الأول", "فريق السهرة الثاني"]);
    assert.deepEqual(imported.teams.map(t => imported.totals[t.id]), [(index + 1) * 3, (index + 1) * 2]);
    check(`game-${index + 1}-result-imported-from-completed-canonical-engine`);
    check(`game-${index + 1}-exactly-one-credit-and-zero-night-debits`, await wallet() === before - index - 1);
    await captureNight(page, `0${index + 2}-after-game`);
    if (index < 2) {
      // Genuine persisted Night transition on both phone and desktop, no fake responses.
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(page.getByTestId("night-transition")).toBeVisible();
        check(`transition-${index + 1}-no-overflow-${width}`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.getByTestId("night-transition").screenshot({ path: join(evidence, `transition-${index + 1}-${width}.png`) });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.reload();
    const restored = await nightRead(page, id);
    assert.deepEqual(restored.teams, imported.teams);
    assert.deepEqual(restored.totals, imported.totals);
    check(`game-${index + 1}-reload-restores-same-identities-and-totals`);
    if (index < 2) {
      await expect(page.getByTestId("night-next")).toBeEnabled();
      const priorWallet = await wallet();
      await clickMutation(page, page.getByTestId("night-next"), `/api/night/${id}/commands`);
      check(`next-${index + 1}-no-extra-debit`, await wallet() === priorWallet);
    }
  }
  step = "champion"; checkpoint();
  await expect(page.getByTestId("night-dashboard")).toHaveAttribute("data-phase", "completed");
  await expect(page.getByTestId("night-champion")).toBeVisible();
  const final = await nightRead(page, id);
  assert.deepEqual(final.winnerIds, [final.teams[0].id]);
  assert.deepEqual(final.teams.map(t => final.totals[t.id]), [9, 6]);
  check("champion-only-after-all-three-verified-games");
  check("canonical-start-debits-exactly-three", await wallet() === before - 3);
  const stranger = await browser.newContext();
  const denied = await stranger.request.get(new URL(`/api/night/${id}`, origin).href);
  check("unauthenticated-night-read-denied", denied.status() === 401);
  await stranger.close();
  step = "real-highlights-and-png-download"; checkpoint();
  await expect(page.getByTestId("night-highlights")).toBeVisible();
  await expect(page.getByTestId("night-highlights")).toContainText("بطل الليلة: فريق السهرة الأول");
  const highlightResponse = await browserHttp(page).get(new URL(`/api/night/${id}/highlights`, origin).href);
  assert.equal(highlightResponse.status(), 200);
  const highlight = (await highlightResponse.json()).highlights;
  assert.equal(highlight.played, 3); assert.deepEqual(highlight.ranking.map(x => x.points), [9, 6]);
  check("highlights-derive-three-actual-completed-engine-results-and-correct-ranking");
  const pendingDownload = page.waitForEvent("download");
  await page.getByTestId("night-share-card").click();
  const download = await pendingDownload; assert.equal(download.suggestedFilename(), "quddam-night.png");
  await download.saveAs(join(evidence, "champion.png"));
  const png = readFileSync(join(evidence, "champion.png"));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
  check("browser-download-produced-real-1200x630-png");
  const card = await browserHttp(page).get(new URL(`/api/night/${id}/share-card`, origin).href);
  assert.equal(card.status(), 200); assert.ok(card.headers()["content-type"].includes("image/png"));
  check("card-private-no-store-no-referrer-noindex", card.headers()["cache-control"].includes("no-store") && card.headers()["referrer-policy"] === "no-referrer" && card.headers()["x-robots-tag"].includes("noindex"));
  const secretCode = invitationPath.split("/").at(-1);
  for (const privateValue of [secretCode, fixture.ownerToken, id]) assert.equal(png.includes(Buffer.from(privateValue)), false);
  check("png-has-no-plaintext-invite-cookie-or-internal-night-identifier");
  await page.getByTestId("night-highlights").screenshot({ path: join(evidence, "highlights.png") });
  const anonymousCard = await browser.newContext();
  check("anonymous-share-card-http-denied", (await anonymousCard.request.get(new URL(`/api/night/${id}/share-card`, origin).href)).status() === 401);
  await anonymousCard.close();
  await captureNight(page, "05-champion");
  step = "completed-night-owner-desktop-vs-explicit-tv"; checkpoint();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(new URL(`/night/${id}`, origin).href);
  await expect(page.getByTestId("night-champion")).toBeVisible();
  await expect(page.locator(".header")).toBeVisible();
  await expect(page.locator(".night-champion-actions")).toBeVisible();
  await expect(page.locator(".night-tv-note")).toBeHidden();
  await page.getByTestId("night-champion").screenshot({ path: join(evidence, "champion-owner-1920.png") });
  await page.getByTestId("night-tv-link").click();
  await expect(page.getByTestId("night-dashboard")).toHaveAttribute("data-tv-mode", "true");
  check("explicit-tv-url", new URL(page.url()).searchParams.get("tv") === "1");
  await expect(page.locator(".header")).toBeHidden();
  await expect(page.locator(".night-champion-actions")).toBeHidden();
  await expect(page.locator(".night-tv-note")).toBeVisible();
  await page.getByTestId("night-champion").screenshot({ path: join(evidence, "champion-tv-1920.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL(`/night/${id}`, origin).href);
  await expect(page.getByTestId("night-champion")).toBeVisible();
  check("champion-phone-no-horizontal-overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.getByTestId("night-champion").screenshot({ path: join(evidence, "champion-owner-390.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  check("ordinary-wide-screen-retains-owner-controls");
  step = "end-an-unfinished-night-through-the-real-ui"; checkpoint();
  const balanceBeforeEnding = await wallet();
  await page.getByRole("link", { name: /^(?:ابدأ )?سهرة جديدة$/ }).click();
  await expect(page.getByTestId("night-setup")).toBeVisible();
  const extra = await clickMutation(page, page.getByTestId("night-create"), "/api/night", 201);
  await expect(page.getByTestId("night-dashboard")).toHaveAttribute("data-phase", "preparing");
  await clickMutation(page, page.getByTestId("night-start"), `/api/night/${extra.night.id}/commands`);
  await page.getByTestId("night-end").click();
  await clickMutation(page, page.getByTestId("night-end-confirm"), `/api/night/${extra.night.id}/commands`);
  await expect(page.getByTestId("night-dashboard")).toHaveAttribute("data-phase", "ended");
  await expect(page.getByTestId("night-ended")).toBeVisible();
  check("end-early-ui-does-not-announce-a-champion", await page.getByTestId("night-champion").count() === 0);
  check("end-early-and-empty-child-lobby-do-not-consume-credit", await wallet() === balanceBeforeEnding);
  await captureNight(page, "06-ended-without-champion");
  const endedCard = await browserHttp(page).get(new URL(`/api/night/${extra.night.id}/share-card`, origin).href);
  check("early-ended-night-has-no-share-card", endedCard.status() === 409 && await page.getByTestId("night-share-card").count() === 0);
  await expect(page.getByTestId("night-highlights")).toContainText("سهرة غير مكتملة؛ لا يُعلَن بطل");
  check("early-ended-highlight-truthfully-reports-incomplete-night");
  step = "real-canonical-final-tie-render-and-card"; checkpoint();
  const nativeCases = JSON.parse(readFileSync(join(output, process.env.NIGHT_PHASE4_NATIVE_RUN ?? "phase4-postgres", "cases.private.json"), "utf8"));
  await page.goto(new URL(`/night/${nativeCases.tieNightId}`, origin).href);
  await expect(page.getByTestId("night-dashboard")).toHaveAttribute("data-phase", "completed");
  await expect(page.getByTestId("night-highlights")).toContainText("انتهت الليلة بتعادل");
  const tie = await nightRead(page, nativeCases.tieNightId); assert.equal(tie.winnerIds.length, 2); assert.deepEqual(tie.teams.map(t => tie.totals[t.id]), [8, 8]);
  const tiedDownload = page.waitForEvent("download"); await page.getByTestId("night-share-card").click();
  await (await tiedDownload).saveAs(join(evidence, "cochampions.png"));
  const tiePng = readFileSync(join(evidence, "cochampions.png"));
  assert.equal(tiePng.readUInt32BE(16), 1200); assert.equal(tiePng.readUInt32BE(20), 630);
  check("real-canonical-final-tie-shows-both-champions-and-downloads-card");

  check("no-unhandled-browser-exception-during-journey", result.errors.pageExceptions === 0);
  check("no-hydration-or-unclassified-console-error", !result.errors.consoleErrorCategories.hydration && !result.errors.consoleErrorCategories["other-redacted"]);
  check("no-external-browser-request-or-automatic-share", result.errors.externalBrowserRequests === 0);
  result.status = "PASSED";
} catch (error) {
  result.status = "FAILED";
  result.failureStep = step;
  result.failureType = error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name) ? error.name : "UnknownError";
  const observedPhase = await activePage?.locator("[data-phase]").first().getAttribute("data-phase").catch(() => null);
  result.failurePhase = /^(?:preparing|playing|completed|ended|LOBBY|READY|ROUND_INTRO|GUESS_ACTIVE|FACE_OFF|TEAM_CONTROL|ANSWERING|STEAL|ORDERING|REVEAL|ROUND_RESULTS|PAUSED|FINAL_RESULTS|COMPLETED|ABANDONED)$/.test(observedPhase ?? "") ? observedPhase : null;
  // Playwright exceptions contain capabilities/answers in URLs and DOM dumps.
  // Retain the checkpoint name only. Reproduce locally to investigate privately.
} finally {
  const exceptionsBeforeCleanup = result.errors.pageExceptions;
  let browserClosed = false, databasePoolEnded = false;
  try { await browser?.close(); browserClosed = !browser?.isConnected(); }
  catch { result.status = "FAILED"; result.failureStep ??= "browser-cleanup"; }
  try { await pool.end(); databasePoolEnded = true; }
  catch { result.status = "FAILED"; result.failureStep ??= "database-pool-cleanup"; }
  result.cleanup = { browserClosed, databasePoolEnded, pageExceptions: result.errors.pageExceptions - exceptionsBeforeCleanup };
  if (result.cleanup.pageExceptions > 0) { result.status = "FAILED"; result.failureStep ??= "browser-cleanup-exception"; }
  result.finishedAt = new Date().toISOString();
  result.passed = result.checks.filter(c => c.passed).length;
  result.failed = result.status === "FAILED" ? 1 : 0;
  writeFileSync(join(evidence, "receipt.json"), JSON.stringify(result, null, 2), { mode: 0o600, flag: "wx" });
}
console.log(JSON.stringify({ status: result.status, passed: result.passed, failed: result.failed, failureStep: result.failureStep ?? null, browser: chromeVersion }));
process.exitCode = result.status === "PASSED" ? 0 : 1;
