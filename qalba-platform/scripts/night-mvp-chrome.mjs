/** Real Chrome, real HTTP, native PostgreSQL, canonical engine UI. No request mocks.
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
const evidence = join(output, process.env.NIGHT_MVP_CHROME_RUN ?? "chrome");
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
  schemaVersion: 1, sourceHead, browser: chromeVersion, headless: true,
  localhostOnly: true, syntheticOnly: true, realHttp: true, nativePostgres: true,
  mocks: false, startedAt: new Date().toISOString(), checks: [], games: [],
  errors: { pageExceptions: 0, consoleErrors: 0, failedRequests: 0, failedRequestCategories: {} },
};
let browser, activePage, step = "launch";
function check(name, value = true) { assert.ok(value, name); result.checks.push({ name, passed: true }); }
function checkpoint() { writeFileSync(join(evidence, "progress.json"), JSON.stringify({ ...result, currentStep: step }), { mode: 0o600 }); }
function observePage(page) {
  page.on("pageerror", () => result.errors.pageExceptions++);
  page.on("console", message => { if (message.type() === "error") result.errors.consoleErrors++; });
  page.on("requestfailed", request => {
    result.errors.failedRequests++;
    const reported = request.failure()?.errorText ?? "UNKNOWN";
    const code = /^net::ERR_[A-Z_]+$/.test(reported) ? reported : "OTHER_REDACTED";
    const eventStream = new URL(request.url()).pathname.endsWith("/events");
    const classification = eventStream && code === "net::ERR_ABORTED" ? "event-stream-navigation-abort" : "other-request-failure";
    const key = `${classification}:${request.method()}:${request.resourceType()}:${code}`;
    result.errors.failedRequestCategories[key] = (result.errors.failedRequestCategories[key] ?? 0) + 1;
  });
}
const sql = async (query, values = []) => (await pool.query(query, values)).rows;
async function wallet() { return (await sql('SELECT "balance" FROM "CreditWallet" WHERE "userId"=$1', [fixture.ownerId]))[0].balance; }
async function nightRead(page, id) { const r = await page.request.get(new URL(`/api/night/${id}`, origin).href); assert.equal(r.status(), 200); return (await r.json()).night; }
async function sourceRead(page, path, id) { const r = await page.request.get(new URL(`/api/${path}/${id}`, origin).href); assert.equal(r.status(), 200); return r.json(); }
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: "qalba_session", value: fixture.ownerToken, url: origin.origin, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  activePage = page;
  observePage(page);
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
  const validInput = { key: crypto.randomUUID(), games: selected, teams: ["فريق السهرة الأول", "فريق السهرة الثاني"] };
  const injected = await page.request.post(new URL("/api/night", origin).href, { headers: { Origin: origin.origin }, data: { ...validInput, totals: { forged: 999 } } });
  check("http-rejects-browser-supplied-night-points", injected.status() === 400);
  const wrongOrigin = await page.request.post(new URL("/api/night", origin).href, { headers: { Origin: "https://untrusted.example.test" }, data: validInput });
  check("http-rejects-cross-origin-night-creation", wrongOrigin.status() === 403);
  const other = await browser.newContext();
  await other.addCookies([{ name: "qalba_session", value: fixture.otherOwnerToken, url: origin.origin, httpOnly: true, sameSite: "Lax" }]);
  const otherRead = await other.request.get(new URL(`/api/night/${id}`, origin).href);
  const otherCommand = await other.request.post(new URL(`/api/night/${id}/commands`, origin).href, { headers: { Origin: origin.origin }, data: { key: crypto.randomUUID(), expectedVersion: created.night.version, op: "START" } });
  check("http-other-authenticated-owner-cannot-read-or-command-night", otherRead.status() === 404 && otherCommand.status() === 404);
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
  await captureNight(page, "05-champion");
  step = "end-an-unfinished-night-through-the-real-ui"; checkpoint();
  const balanceBeforeEnding = await wallet();
  await page.getByRole("link", { name: "ابدأ سهرة جديدة", exact: true }).click();
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
  check("no-unhandled-browser-exception-during-journey", result.errors.pageExceptions === 0);
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
