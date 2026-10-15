/** Synthetic-only process-restart and default-off acceptance.
 * Stop the separately owned dev server first. This script refuses an occupied
 * loopback port, starts/stops only its own process groups, and issues only GETs.
 * Required: NIGHT_MVP_SYNTHETIC=1, NIGHT_MVP_ENV_FILE, NIGHT_MVP_OUTPUT,
 * NIGHT_MVP_JOURNEY_FILE (private completed Chrome journey), CHROME_EXECUTABLE.
 * Run: node --import tsx scripts/night-mvp-restart.ts
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { isAbsolute, join, relative } from "node:path";
import { chromium, expect, type Browser, type BrowserContext } from "@playwright/test";
import { db } from "../src/lib/db";
import type { NightView } from "../src/lib/night/types";
import { isolatedEnvironment, loadFixture } from "./night-mvp-fixtures";

const origin = "http://127.0.0.1:3000";
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type OwnedServer = { child: ChildProcess; pid: number; exited: boolean; label: string };
type Check = { name: string; passed: true };
const checks: Check[] = [];
const result = {
  schemaVersion: 1, sourceHead: "", sourceInventoryBefore: "", sourceInventoryAfter: "",
  cleanWorkingTreeBefore: false, cleanWorkingTreeAfter: false,
  syntheticOnly: true, loopbackOnly: true, headless: true, realChrome: true,
  realProcessRestart: true, requestMocks: false, explicitMutationRequests: 0,
  existingIdempotentWelcomeSqlMayExecute: true,
  startedAt: new Date().toISOString(), finishedAt: "", browser: "", sandboxDisabled: false,
  processesStarted: 0, gracefulStops: 0, forcedStops: 0,
  errors: { pageExceptions: 0, consoleErrors: 0, failedRequests: 0 },
  statusChecks: [] as { route: string; status: number; expected: number }[],
  checks, passed: false,
};
let evidence = "", step = "guards", server: OwnedServer | null = null, browser: Browser | null = null;
function checkpoint() {
  if (evidence) writeFileSync(join(evidence, "progress.json"), JSON.stringify({ ...result, step }), { mode: 0o600 });
}
function check(name: string, condition = true) { assert.ok(condition, name); checks.push({ name, passed: true }); checkpoint(); }
function sourceInventory() {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean).sort();
  const rows = files.map(file => {
    const path = join(root, file), info = lstatSync(path);
    assert.ok(info.isFile(), "Tracked source inventory supports regular files only");
    return { file, mode: info.mode & 0o777, hash: createHash("sha256").update(readFileSync(path)).digest("hex") };
  });
  return digest(rows);
}
async function portOccupied(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port: 3000 });
    socket.setTimeout(750);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); reject(new Error("Port probe timed out")); });
    socket.once("error", error => {
      socket.destroy();
      if ((error as NodeJS.ErrnoException).code === "ECONNREFUSED") resolve(false);
      else reject(new Error("Port probe failed"));
    });
  });
}
async function stopOwnedServer() {
  const owned = server;
  if (!owned) return;
  server = null;
  // The process group was created by this invocation. Never signal an existing listener.
  try { process.kill(-owned.pid, "SIGTERM"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  const deadline = Date.now() + 20_000;
  while ((!owned.exited || await portOccupied()) && Date.now() < deadline) await pause(200);
  if (!owned.exited || await portOccupied()) {
    result.forcedStops++;
    try { process.kill(-owned.pid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    const forcedDeadline = Date.now() + 5_000;
    while (await portOccupied() && Date.now() < forcedDeadline) await pause(100);
  } else result.gracefulStops++;
  assert.equal(await portOccupied(), false, "Owned server must release loopback port before another process starts");
}
async function startOwnedServer(label: string, enabled: boolean, databaseUrl: string, authSecret: string, cookie: string, nightId: string) {
  assert.equal(server, null);
  assert.equal(await portOccupied(), false, "Refusing to replace or stop a listener owned by another process");
  const env: NodeJS.ProcessEnv = { NODE_ENV: "development" };
  for (const name of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS"]) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  Object.assign(env, { NODE_ENV: "development", CI: "true", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: databaseUrl, DATABASE_POOL_MAX: "4", APP_URL: origin, AUTH_RATE_LIMIT_SECRET: authSecret });
  if (enabled) env.ENABLE_NIGHT_OF_QUDDAM = "true";
  assert.equal(env.ENABLE_NIGHT_OF_QUDDAM, enabled ? "true" : undefined);
  const logfile = openSync(join(evidence, `${label}.server.private.log`), "wx", 0o600);
  let child: ChildProcess;
  try {
    child = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3000"], { cwd: process.cwd(), env, detached: true, stdio: ["ignore", logfile, logfile] });
  } finally { closeSync(logfile); }
  assert.ok(child.pid, "Owned development process must start");
  const owned: OwnedServer = { child, pid: child.pid, exited: false, label };
  child.once("exit", () => { owned.exited = true; });
  child.once("error", () => { owned.exited = true; });
  server = owned;
  result.processesStarted++;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    assert.equal(owned.exited, false, "Owned development process exited before readiness");
    try {
      const response = await fetch(`${origin}/api/night/${encodeURIComponent(nightId)}`, { headers: { Cookie: cookie }, redirect: "manual", signal: AbortSignal.timeout(5_000) });
      const status = response.status;
      await response.arrayBuffer();
      if (status === (enabled ? 200 : 404)) return;
    } catch { /* Compilation/readiness failures stay in the private server log. */ }
    await pause(500);
  }
  throw new Error("Owned development process readiness timed out");
}
async function readNight(cookie: string, nightId: string): Promise<NightView> {
  const response = await fetch(`${origin}/api/night/${encodeURIComponent(nightId)}`, { headers: { Cookie: cookie }, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, "Authenticated Night read must succeed");
  const value = await response.json() as { night: NightView };
  assert.equal(value.night.id, nightId);
  return value.night;
}
async function persistedSnapshot(ownerId: string, nightId: string) {
  const night = await db().nightSession.findUniqueOrThrow({ where: { id: nightId }, include: { games: { orderBy: { position: "asc" } }, commands: { orderBy: { id: "asc" } } } });
  assert.equal(night.ownerId, ownerId);
  const ids = night.games.flatMap(slot => slot.sourceSessionId ? [slot.sourceSessionId] : []);
  const [sessions, teams, commands, scoreEvents, wallet, ledger, auth, analytics] = await Promise.all([
    db().gameSession.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } }),
    db().team.findMany({ where: { sessionId: { in: ids } }, orderBy: { id: "asc" } }),
    db().gameCommand.findMany({ where: { sessionId: { in: ids } }, orderBy: { id: "asc" } }),
    db().scoreEvent.findMany({ where: { sessionId: { in: ids } }, orderBy: { id: "asc" } }),
    db().creditWallet.findUniqueOrThrow({ where: { userId: ownerId } }),
    db().gameCredit.findMany({ where: { userId: ownerId }, orderBy: { id: "asc" } }),
    db().authSession.findMany({ where: { userId: ownerId }, orderBy: { id: "asc" } }),
    db().analyticsEvent.findMany({ where: { userId: ownerId }, orderBy: { id: "asc" } }),
  ]);
  return digest({ night, sessions, teams, commands, scoreEvents, wallet, ledger, auth, analytics });
}
async function ownerContext(token: string) {
  assert.ok(browser);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: "qalba_session", value: token, url: origin, httpOnly: true, sameSite: "Lax" }]);
  context.on("page", page => {
    page.on("pageerror", () => result.errors.pageExceptions++);
    page.on("console", message => { if (message.type() === "error") result.errors.consoleErrors++; });
    page.on("requestfailed", () => result.errors.failedRequests++);
    page.on("request", request => { if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) result.explicitMutationRequests++; });
  });
  return context;
}
async function main() {
  assert.equal(process.platform, "linux", "Owned process-group cleanup requires Linux");
  const { output } = isolatedEnvironment(), fixture = await loadFixture();
  for (const file of [".env", ".env.local", ".env.development", ".env.development.local"]) assert.equal(existsSync(join(process.cwd(), file)), false, "Refusing automatic dotenv loading in synthetic child processes");
  const journeyFile = process.env.NIGHT_MVP_JOURNEY_FILE;
  assert.ok(journeyFile && isAbsolute(journeyFile), "Private completed journey file required");
  const journeyPath = realpathSync(journeyFile);
  assert.ok(relative(process.cwd(), journeyPath).startsWith(".."));
  assert.equal(statSync(journeyPath).mode & 0o077, 0);
  const journey = JSON.parse(readFileSync(journeyPath, "utf8")) as { ownerId: string; nightId: string };
  assert.equal(journey.ownerId, fixture.ownerId);
  assert.match(journey.nightId, /^[A-Za-z0-9_-]{1,100}$/);
  const run = process.env.NIGHT_MVP_RESTART_RUN ?? `restart-${Date.now()}`;
  assert.match(run, /^[A-Za-z0-9_-]{1,100}$/);
  const requestedEvidence = join(output, run);
  mkdirSync(requestedEvidence, { mode: 0o700 });
  evidence = requestedEvidence;
  const executablePath = process.env.CHROME_EXECUTABLE;
  assert.ok(executablePath && isAbsolute(executablePath), "Actual Google Chrome executable required");
  result.browser = execFileSync(executablePath, ["--version"], { encoding: "utf8" }).trim();
  assert.match(result.browser, /^Google Chrome/);
  result.sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  result.cleanWorkingTreeBefore = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() === "";
  result.sourceInventoryBefore = sourceInventory();
  result.sandboxDisabled = process.env.NIGHT_MVP_CHROME_NO_SANDBOX === "1";
  checkpoint();
  assert.equal(await portOccupied(), false, "Existing development listener must be stopped by its owner first");
  const before = await persistedSnapshot(fixture.ownerId, journey.nightId);
  const cookie = `qalba_session=${fixture.ownerToken}`, authSecret = randomBytes(32).toString("hex");
  assert.ok(process.env.DATABASE_URL);
  step = "first-process-authoritative-read"; checkpoint();
  await startOwnedServer("first-enabled", true, process.env.DATABASE_URL, authSecret, cookie, journey.nightId);
  const baseline = await readNight(cookie, journey.nightId);
  assert.equal(baseline.phase, "completed");
  assert.equal(baseline.results.length, 3);
  assert.equal(baseline.teams.length, 2);
  assert.ok(baseline.winnerIds.length > 0);
  check("first-fresh-process-restores-completed-saved-series");
  await stopOwnedServer();
  check("first-owned-process-terminated-and-released-port");
  step = "second-process-restoration"; checkpoint();
  await startOwnedServer("second-enabled", true, process.env.DATABASE_URL, authSecret, cookie, journey.nightId);
  const restored = await readNight(cookie, journey.nightId);
  assert.deepEqual(restored, baseline);
  check("second-fresh-process-deep-equal-authoritative-dto");
  browser = await chromium.launch({ executablePath, headless: true, ...(result.sandboxDisabled ? { args: ["--no-sandbox"] } : {}) });
  let context: BrowserContext = await ownerContext(fixture.ownerToken);
  let page = await context.newPage();
  const navigation = await page.goto(`${origin}/night/${encodeURIComponent(journey.nightId)}`);
  assert.equal(navigation?.status(), 200);
  await expect(page.getByTestId("night-dashboard")).toHaveAttribute("data-phase", "completed");
  await expect(page.getByTestId("night-dashboard")).toHaveAttribute("data-version", String(baseline.version));
  await expect(page.getByTestId("night-champion")).toBeVisible();
  assert.deepEqual(await page.getByTestId("night-total").allTextContents(), baseline.ranking.map(team => String(team.points)));
  for (const team of baseline.teams) {
    await expect(page.getByTestId("night-leaderboard").getByRole("rowheader", { name: team.name, exact: true })).toHaveCount(1);
    await expect(page.getByTestId("night-leaderboard").locator(`[data-team="${team.id}"]`)).toHaveCount(1);
    if (baseline.winnerIds.includes(team.id)) await expect(page.getByTestId("night-champion")).toContainText(team.name);
  }
  check("real-chrome-fresh-context-restores-champion-identities-version-and-totals");
  await context.close();
  await stopOwnedServer();
  check("second-owned-process-terminated-and-released-port");
  step = "third-process-default-off"; checkpoint();
  await startOwnedServer("third-default-off", false, process.env.DATABASE_URL, authSecret, cookie, journey.nightId);
  for (const [route, path] of [["night-home", "/night"], ["night-new", "/night/new"], ["saved-night-page", `/night/${encodeURIComponent(journey.nightId)}`], ["saved-night-api", `/api/night/${encodeURIComponent(journey.nightId)}`]]) {
    const response = await fetch(`${origin}${path}`, { headers: { Cookie: cookie }, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    result.statusChecks.push({ route, status: response.status, expected: 404 }); checkpoint();
    await response.arrayBuffer(); assert.equal(response.status, 404, "Default-off Night page/API must be unavailable");
  }
  check("default-off-new-process-denies-night-pages-and-saved-night-api");
  context = await ownerContext(fixture.ownerToken);
  page = await context.newPage();
  const library = await page.goto(`${origin}/games`);
  assert.equal(library?.status(), 200);
  await expect(page.locator(".games-grid .game-card")).toHaveCount(10);
  await expect(page.locator('a[href="/night"], a[href="/night/new"]')).toHaveCount(0);
  check("default-off-real-chrome-library-retains-ten-games-without-night-entry");
  const sourceHref = baseline.games[0].hostHref;
  assert.ok(sourceHref && /^\/(ranked|ordering|survey-show)\/host\/[A-Za-z0-9_-]+$/.test(sourceHref));
  const host = await page.goto(`${origin}${sourceHref}`);
  assert.equal(host?.status(), 200);
  await expect(page.getByTestId("night-return-link")).toHaveCount(0);
  const sourceHostClass = { "top-list": ".ranked-host", "ordering-challenge": ".ordering-host", "survey-show": ".survey-host" }[baseline.games[0].game];
  await expect(page.locator(sourceHostClass)).toHaveAttribute("data-phase", "COMPLETED");
  check("default-off-original-host-page-retains-game-without-night-return-link");
  await context.close();
  await browser.close(); browser = null;
  await stopOwnedServer();
  check("all-three-owned-processes-stopped-and-loopback-port-released");
  assert.equal(await persistedSnapshot(fixture.ownerId, journey.nightId), before);
  check("night-child-results-wallet-ledger-auth-and-analytics-persisted-state-unchanged");
  assert.equal(result.explicitMutationRequests, 0);
  check("browser-issued-no-mutation-requests-and-test-sent-only-gets");
  assert.equal(result.errors.pageExceptions, 0);
  check("real-chrome-had-no-unhandled-page-exceptions");
  result.sourceInventoryAfter = sourceInventory();
  result.cleanWorkingTreeAfter = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() === "";
  assert.equal(result.sourceInventoryAfter, result.sourceInventoryBefore);
  check("tracked-source-inventory-unchanged-across-all-processes");
  result.finishedAt = new Date().toISOString(); result.passed = true; step = "complete";
}
let failureClass: string | null = null;
main().catch(error => {
  failureClass = error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name) ? error.name : "UnknownError";
  result.passed = false;
  process.exitCode = 1;
}).finally(async () => {
  try { await browser?.close(); } catch { failureClass ??= "BrowserCleanupError"; result.passed = false; process.exitCode = 1; }
  try { await stopOwnedServer(); } catch { failureClass ??= "ServerCleanupError"; result.passed = false; process.exitCode = 1; }
  try { await db().$disconnect(); } catch { failureClass ??= "DatabaseCleanupError"; result.passed = false; process.exitCode = 1; }
  result.finishedAt = new Date().toISOString();
  if (evidence) {
    const filename = result.passed ? "receipt.json" : "failure.json";
    writeFileSync(join(evidence, filename), JSON.stringify({ ...result, step, failureClass, privateValuesWithheld: true }), { mode: 0o600, flag: "wx" });
  }
  console.log(`Night restart/default-off acceptance ${result.passed ? "PASS" : "FAILED"}: ${checks.length} checks; ${failureClass ?? "no failure"}; private values withheld.`);
});
