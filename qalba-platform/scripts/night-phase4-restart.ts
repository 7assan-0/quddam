/** Phase 4 native production-build restart/default-off acceptance on loopback only.
 * Refuses an occupied port. Starts/stops only process groups created by this run.
 * Requires the guarded synthetic DB, completed real Chrome journey, and built Next.
 * No customer DB, deployment, new listener address, source mocks or result writes.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { isAbsolute, join, relative } from "node:path";
import { chromium, expect, type Browser, type BrowserContext, type Page, type Response as BrowserResponse } from "@playwright/test";
import { db } from "../src/lib/db";
import type { NightView } from "../src/lib/night/types";
import { isolatedEnvironment, loadFixture } from "./night-mvp-fixtures";

const origin = "http://127.0.0.1:3000";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const gitEnv = { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" };
type OwnedServer = { child: ChildProcess; pid: number; exited: boolean };
type StatusCheck = { route: string; status: number; expected: number };
const result = {
  schemaVersion: 1, sourceHead: "", sourceInventoryBefore: "", sourceInventoryAfter: "",
  syntheticOnly: true, nativePostgres: true, realChrome: true, realBuiltNextProcesses: true,
  loopbackOnly: true, headless: true, requestMocks: false, sandboxDisabled: false,
  browser: "", processesStarted: 0, gracefulStops: 0, forcedStops: 0,
  errors: { pageExceptions: 0, consoleErrors: 0, failedRequests: 0 },
  statusChecks: [] as StatusCheck[], checks: [] as { name: string; passed: true }[],
  status: "FAILED", startedAt: new Date().toISOString(), finishedAt: "",
};
let evidence = "", step = "guards", server: OwnedServer | null = null, browser: Browser | null = null;
function checkpoint() { if (evidence) writeFileSync(join(evidence, "progress.json"), JSON.stringify({ ...result, step }), { mode: 0o600 }); }
function check(name: string, value = true) { assert.ok(value, name); result.checks.push({ name, passed: true }); checkpoint(); }
function sourceInventory() {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", env: gitEnv }).trim();
  const head = execFileSync("git", ["rev-parse", "--verify", "HEAD^{commit}"], { encoding: "utf8", env: gitEnv }).trim();
  assert.equal(head, result.sourceHead);
  const tree = execFileSync("git", ["ls-tree", "-r", "-z", "--full-tree", head], { encoding: "utf8", env: gitEnv }).split("\0").filter(Boolean);
  const rows = tree.map(entry => {
    const match = /^(100644|100755) blob ([a-f0-9]{40,64})\t(.+)$/.exec(entry);
    assert.ok(match, "Only committed regular source files are supported");
    const [, mode, object, file] = match;
    const path = join(root, file), stat = lstatSync(path);
    assert.ok(stat.isFile()); assert.equal(stat.mode & 0o111 ? "100755" : "100644", mode);
    const expected = execFileSync("git", ["cat-file", "blob", object], { cwd: root, env: gitEnv, maxBuffer: 32 * 1024 * 1024 });
    const actual = readFileSync(path); assert.deepEqual(actual, expected, "Source bytes must match literal committed object");
    return { file, mode, object, sha256: createHash("sha256").update(actual).digest("hex") };
  });
  return digest(rows);
}
async function portOccupied(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port: 3000 }); socket.setTimeout(750);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); reject(new Error("Port probe timed out")); });
    socket.once("error", error => { socket.destroy(); if ((error as NodeJS.ErrnoException).code === "ECONNREFUSED") resolve(false); else reject(new Error("Port probe failed")); });
  });
}
async function stopOwnedServer() {
  const owned = server; if (!owned) return; server = null;
  try { process.kill(-owned.pid, "SIGTERM"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  const deadline = Date.now() + 20_000;
  while ((!owned.exited || await portOccupied()) && Date.now() < deadline) await pause(100);
  if (!owned.exited || await portOccupied()) {
    result.forcedStops++;
    try { process.kill(-owned.pid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    const forced = Date.now() + 5_000; while (await portOccupied() && Date.now() < forced) await pause(100);
  } else result.gracefulStops++;
  assert.equal(await portOccupied(), false, "Owned process must release loopback port");
}
async function startOwnedServer(label: string, enabled: boolean, databaseUrl: string, authSecret: string) {
  assert.equal(server, null); assert.equal(await portOccupied(), false, "Refusing an existing listener");
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  for (const name of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS"]) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  Object.assign(env, { NODE_ENV: "production", CI: "true", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: databaseUrl,
    DATABASE_POOL_MAX: "4", APP_URL: origin, AUTH_RATE_LIMIT_SECRET: authSecret, TRUST_PROXY: "false" });
  if (enabled) env.ENABLE_NIGHT_OF_QUDDAM = "true";
  const fd = openSync(join(evidence, `${label}.server.private.log`), "wx", 0o600);
  let child: ChildProcess;
  try {
    // This is the approved local built-runtime launcher, not a public deployment.
    child = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3000"],
      { cwd: process.cwd(), env, detached: true, stdio: ["ignore", fd, fd] });
  } finally { closeSync(fd); }
  assert.ok(child.pid); const owned = { child, pid: child.pid, exited: false };
  child.once("exit", () => { owned.exited = true; }); child.once("error", () => { owned.exited = true; });
  server = owned; result.processesStarted++;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    assert.equal(owned.exited, false, "Owned built server exited before readiness");
    try { const response = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(3000) }); await response.arrayBuffer(); if (response.status === 200) return; }
    catch { /* Readiness details remain only in the owner-only external server log. */ }
    await pause(250);
  }
  throw new Error("Owned built server readiness timed out");
}
function privateFile(path: string) {
  assert.ok(isAbsolute(path)); const actual = realpathSync(path);
  assert.ok(relative(process.cwd(), actual).startsWith("..")); assert.equal(statSync(actual).mode & 0o077, 0);
  return JSON.parse(readFileSync(actual, "utf8"));
}
async function browserGet(page: Page, path: string) {
  return page.evaluate(async path => { const response = await fetch(path, { cache: "no-store", credentials: "same-origin" });
    const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
    return { status: response.status, body, cache: response.headers.get("cache-control") };
  }, path);
}
function observe(context: BrowserContext) {
  context.on("page", page => {
    page.on("pageerror", () => result.errors.pageExceptions++);
    page.on("console", message => { if (message.type() === "error") result.errors.consoleErrors++; });
    page.on("requestfailed", () => result.errors.failedRequests++);
  });
}
async function ownerContext(token: string) {
  assert.ok(browser); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: "qalba_session", value: token, url: origin, secure: true, httpOnly: true, sameSite: "Lax" }]);
  observe(context); return context;
}
async function persistedSnapshot(ownerId: string, nightId: string) {
  const night = await db().nightSession.findUniqueOrThrow({ where: { id: nightId }, include: {
    games: { orderBy: { position: "asc" } }, commands: { orderBy: { id: "asc" } },
    invitation: { include: { guests: { orderBy: { id: "asc" } } } },
  } });
  assert.equal(night.ownerId, ownerId);
  const ids = night.games.flatMap(game => game.sourceSessionId ? [game.sourceSessionId] : []);
  const [sessions, teams, commands, scoreEvents, wallet, ledger] = await Promise.all([
    db().gameSession.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } }),
    db().team.findMany({ where: { sessionId: { in: ids } }, orderBy: { id: "asc" } }),
    db().gameCommand.findMany({ where: { sessionId: { in: ids } }, orderBy: { id: "asc" } }),
    db().scoreEvent.findMany({ where: { sessionId: { in: ids } }, orderBy: { id: "asc" } }),
    db().creditWallet.findUniqueOrThrow({ where: { userId: ownerId } }),
    db().gameCredit.findMany({ where: { userId: ownerId }, orderBy: { id: "asc" } }),
  ]);
  return digest({ night, sessions, teams, commands, scoreEvents, wallet, ledger });
}
async function main() {
  assert.equal(process.platform, "linux");
  const { output } = isolatedEnvironment(), fixture = await loadFixture();
  for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) assert.equal(existsSync(join(process.cwd(), file)), false, "Refusing implicit dotenv loading");
  assert.equal(existsSync(join(process.cwd(), ".next/BUILD_ID")), true, "Production build must exist before this test");
  const journeyPath = process.env.NIGHT_MVP_JOURNEY_FILE; assert.ok(journeyPath);
  const journey = privateFile(journeyPath) as { ownerId: string; nightId: string };
  assert.equal(journey.ownerId, fixture.ownerId); assert.match(journey.nightId, /^[A-Za-z0-9_-]{1,100}$/);
  const journeyDirectory = join(realpathSync(journeyPath), "..");
  // Files are emitted by the actual Chrome organizer/anonymous RSVP journey.
  const invitation = privateFile(join(journeyDirectory, "invitation.private.json")) as { path: string };
  assert.match(invitation.path, /^\/night\/invite\/[a-f0-9]{64}$/);
  const guestCookies = privateFile(join(journeyDirectory, "guest-cookies.private.json")) as Parameters<BrowserContext["addCookies"]>[0];
  assert.equal(guestCookies.filter(cookie => cookie.name.startsWith("quddam_night_rsvp_")).length, 1);
  assert.ok(guestCookies.every(cookie => cookie.domain === "127.0.0.1" && cookie.httpOnly));
  const run = process.env.NIGHT_PHASE4_RUN ?? `phase4-restart-${Date.now()}`; assert.match(run, /^[A-Za-z0-9_-]{1,100}$/);
  evidence = join(output, run); mkdirSync(evidence, { mode: 0o700 });
  const executablePath = process.env.CHROME_EXECUTABLE; assert.ok(executablePath && isAbsolute(executablePath));
  result.browser = execFileSync(executablePath, ["--version"], { encoding: "utf8" }).trim(); assert.match(result.browser, /^Google Chrome/);
  result.sourceHead = execFileSync("git", ["rev-parse", "--verify", "HEAD^{commit}"], { encoding: "utf8", env: gitEnv }).trim();
  result.sourceInventoryBefore = sourceInventory(); result.sandboxDisabled = process.env.NIGHT_MVP_CHROME_NO_SANDBOX === "1";
  assert.equal(await portOccupied(), false, "Existing loopback listener must be stopped by its owner first");
  assert.ok(process.env.DATABASE_URL); const databaseUrl = process.env.DATABASE_URL, secret = randomBytes(32).toString("hex");
  const before = await persistedSnapshot(fixture.ownerId, journey.nightId);
  browser = await chromium.launch({ executablePath, headless: true, ...(result.sandboxDisabled ? { args: ["--no-sandbox"] } : {}) });
  let baseline: NightView | null = null, baselineInvitation: unknown = null;
  for (const [index, label] of ["first-enabled", "second-enabled"].entries()) {
    step = label; checkpoint(); await startOwnedServer(label, true, databaseUrl, secret);
    const owner = await ownerContext(fixture.ownerToken), page = await owner.newPage();
    const navigation = await page.goto(`${origin}/night/${journey.nightId}`); assert.equal(navigation?.status(), 200);
    await expect(page.getByTestId("night-dashboard")).toHaveAttribute("data-phase", "completed");
    const current = await browserGet(page, `/api/night/${journey.nightId}`); assert.equal(current.status, 200);
    const night = current.body.night as NightView; assert.equal(night.results.length, 3); assert.equal(night.phase, "completed");
    if (baseline) assert.deepEqual(night, baseline); else baseline = night;
    await expect(page.getByTestId("night-highlights")).toBeVisible(); await expect(page.getByTestId("night-share-card")).toBeVisible();
    check(`${label}-chrome-restores-source-results-highlights-and-champion-card-link`);
    const ownerInvite = await browserGet(page, `/api/night/${journey.nightId}/invitation`); assert.equal(ownerInvite.status, 200);
    assert.equal("path" in ownerInvite.body.invitation, false); assert.equal("tokenHash" in ownerInvite.body.invitation, false);
    if (baselineInvitation) assert.deepEqual(ownerInvite.body.invitation, baselineInvitation); else baselineInvitation = ownerInvite.body.invitation;
    check(`${label}-owner-summary-persists-without-secret-link-recovery`);
    const png = await page.evaluate(async path => { const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
      const bytes = new Uint8Array(await response.arrayBuffer()); return { status: response.status, signature: [...bytes.slice(0, 8)],
        width: new DataView(bytes.buffer).getUint32(16), height: new DataView(bytes.buffer).getUint32(20), cache: response.headers.get("cache-control") }; }, `/api/night/${journey.nightId}/share-card`);
    assert.equal(png.status, 200); assert.deepEqual(png.signature, [137, 80, 78, 71, 13, 10, 26, 10]); assert.equal(png.width, 1200); assert.equal(png.height, 630); assert.ok(png.cache?.includes("no-store"));
    check(`${label}-private-real-png-renders-after-fresh-built-process`);
    await owner.close();
    const guest: BrowserContext = await browser.newContext(); await guest.addCookies(guestCookies); observe(guest);
    const guestPage: Page = await guest.newPage(); const guestDocument: BrowserResponse | null = await guestPage.goto(`${origin}${invitation.path}`); assert.equal(guestDocument?.status(), 200);
    const publicState = await browserGet(guestPage, invitation.path.replace("/night/invite/", "/api/night/invite/"));
    assert.equal(publicState.status, 200); assert.equal(publicState.body.invitation.open, false); assert.ok(publicState.body.invitation.mine);
    await expect(guestPage.getByRole("status").filter({ hasText: "ردّك المحفوظ" })).toBeVisible();
    await expect(guestPage.getByRole("button", { name: /تأكيد ردي|تحديث ردي وتصويتي/ })).toHaveCount(0);
    check(`${label}-anonymous-cookie-restores-own-rsvp-and-closed-ballot`);
    await guest.close(); await stopOwnedServer(); check(`${label}-owned-process-stopped-and-port-released`);
    if (index === 1) assert.equal(await persistedSnapshot(fixture.ownerId, journey.nightId), before);
  }
  check("complete-night-invitation-ballots-source-results-wallet-and-ledger-unchanged-after-restart");
  step = "third-default-off"; checkpoint(); await startOwnedServer(step, false, databaseUrl, secret);
  const cookie = `qalba_session=${fixture.ownerToken}`;
  const routes: [string, string][] = [
    ["night-home-page", "/night"], ["night-new-page", "/night/new"], ["night-saved-page", `/night/${journey.nightId}`],
    ["invitation-page", invitation.path], ["night-api", `/api/night/${journey.nightId}`],
    ["owner-invitation-api", `/api/night/${journey.nightId}/invitation`], ["public-invitation-api", invitation.path.replace("/night/invite/", "/api/night/invite/")],
    ["highlights-api", `/api/night/${journey.nightId}/highlights`], ["share-card-api", `/api/night/${journey.nightId}/share-card`],
  ];
  for (const [route, path] of routes) {
    const response = await fetch(`${origin}${path}`, { headers: { Cookie: cookie }, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    result.statusChecks.push({ route, status: response.status, expected: 404 }); await response.arrayBuffer(); assert.equal(response.status, 404);
  }
  check("default-off-built-process-denies-all-night-invitation-highlights-and-card-pages-apis");
  for (const [route, path] of [["night-create-post", "/api/night"], ["night-command-post", `/api/night/${journey.nightId}/commands`],
    ["owner-invitation-post", `/api/night/${journey.nightId}/invitation`], ["anonymous-rsvp-post", invitation.path.replace("/night/invite/", "/api/night/invite/")]]) {
    const response = await fetch(`${origin}${path}`, { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(30_000) });
    result.statusChecks.push({ route, status: response.status, expected: 404 }); await response.arrayBuffer(); assert.equal(response.status, 404);
  }
  check("default-off-posts-refused-before-authority-or-mutation");
  const offOwner = await ownerContext(fixture.ownerToken), offPage = await offOwner.newPage();
  assert.equal((await offPage.goto(`${origin}/games`))?.status(), 200);
  await expect(offPage.locator(".games-grid .game-card")).toHaveCount(10);
  await expect(offPage.locator('a[href="/night"], a[href="/night/new"]')).toHaveCount(0);
  check("default-off-original-ten-game-library-still-works-without-night-entry");
  await offOwner.close(); await stopOwnedServer();
  assert.equal(await persistedSnapshot(fixture.ownerId, journey.nightId), before);
  check("all-denied-posts-and-restarts-preserve-night-invitation-votes-credit-state");
  assert.equal(result.errors.pageExceptions, 0); check("no-unhandled-real-chrome-page-exceptions");
  result.sourceInventoryAfter = sourceInventory(); assert.equal(result.sourceInventoryAfter, result.sourceInventoryBefore);
  check("literal-committed-source-bytes-modes-objects-unchanged-during-test");
  assert.equal(result.processesStarted, 3); assert.equal(result.gracefulStops, 3); assert.equal(result.forcedStops, 0);
  check("three-owned-built-runtime-processes-exited-gracefully-without-existing-listener-interference");
  result.status = "PASSED"; step = "complete";
}
let failureClass: string | null = null;
main().catch(error => { failureClass = error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name) ? error.name : "UnknownError"; process.exitCode = 1; })
  .finally(async () => {
    try { await browser?.close(); } catch { result.status = "FAILED"; failureClass ??= "BrowserCleanupError"; process.exitCode = 1; }
    try { await stopOwnedServer(); } catch { result.status = "FAILED"; failureClass ??= "ServerCleanupError"; process.exitCode = 1; }
    try { await db().$disconnect(); } catch { result.status = "FAILED"; failureClass ??= "DatabaseCleanupError"; process.exitCode = 1; }
    result.finishedAt = new Date().toISOString();
    const receipt = { ...result, step, failureClass, passed: result.checks.length, failed: result.status === "PASSED" ? 0 : 1, privateValuesWithheld: true };
    if (evidence) writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2), { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ status: receipt.status, passed: receipt.passed, failed: receipt.failed, failureStep: receipt.status === "PASSED" ? null : step, failureClass }));
  });
