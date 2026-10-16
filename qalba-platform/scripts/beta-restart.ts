/** Read-only Beta restart/feature-flag acceptance against the guarded synthetic PG17 DB.
 * Requires successful Night and Shillatak Chrome journeys on the exact committed SHA.
 * Starts only owned production-built Next processes on the already approved loopback
 * address. Refuses an occupied port, never seeds/grants/changes results, and writes
 * non-overwriting evidence outside the checkout. This is not a production deployment.
 */
import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync,
  realpathSync, statSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { isAbsolute, join, relative, sep } from "node:path";
import { chromium, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { db } from "../src/lib/db";
import type { NightView } from "../src/lib/night/types";
import type { getShillaView } from "../src/lib/shillatak/service";
import { isolatedEnvironment, loadFixture } from "./night-mvp-fixtures";

type ShillaView = Awaited<ReturnType<typeof getShillaView>>;
type OwnedServer = { child: ChildProcess; pid: number; startTicks: string; exited: boolean };
type Binding = { commit: string; tree: string; sourceFingerprint: string; objectInventorySha256: string; fileCount: number };
type PrivateJourney = { ownerId: string; nightId: string; groupId: string; invitePath: string };
type StatusCheck = { variant: string; route: string; method: string; status: number; expected: number };
const origin = "http://127.0.0.1:3000";
const sha256 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
// Repository overrides must not redirect either the literal binding or checkout identity.
const gitEnv: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_"))),
  NODE_ENV: process.env.NODE_ENV ?? "test" };
gitEnv.GIT_NO_REPLACE_OBJECTS = "1";
const result = {
  schemaVersion: 1, sourceHead: "", sourceTree: "", sourceInventoryBefore: "", sourceInventoryAfter: "",
  sourceObjectsBefore: "", sourceObjectsAfter: "", sourceFileCount: 0,
  sourceBindingTool: "ci/financial-review/source-binding.py", generatedArtifactsVerifiedBySourceBinding: false,
  buildIdSha256: "", predecessorReleaseApprovalInherited: false,
  buildSourceProvenance: "Requires the caller's independent successful clean build gate on this same SHA; BUILD_ID alone is not source provenance.",
  syntheticOnly: true, nativePostgres17: false, realChrome: false, realBuiltNextProcesses: false,
  loopbackOnly: true, headless: true, requestMocks: false, databaseResultWrites: false,
  fixtureGrants: false, successfulWriteRequests: 0, sandboxDisabled: false,
  browser: "", processesStarted: 0, gracefulStops: 0, forcedStops: 0,
  observations: { pageExceptions: 0, consoleErrors: 0, failedRequests: 0, externalBrowserRequests: 0,
    consoleErrorCategories: {} as Record<string, number>, failedRequestCategories: {} as Record<string, number> },
  statusChecks: [] as StatusCheck[], checks: [] as { name: string; passed: true }[],
  status: "INCOMPLETE", startedAt: new Date().toISOString(), finishedAt: "",
};
let output = "", evidence = "", step = "guards", failureClass: string | null = null;
let server: OwnedServer | null = null, browser: Browser | null = null;
let interrupted = false, checksComplete = false, databaseOpened = false;

function checkpoint() {
  if (evidence) writeFileSync(join(evidence, "progress.json"), JSON.stringify({ ...result, step }), { mode: 0o600 });
}
function check(name: string, condition = true) {
  assert.equal(interrupted, false); assert.ok(condition, name);
  result.checks.push({ name, passed: true }); checkpoint();
}
function privateFile(path: string): unknown {
  assert.ok(isAbsolute(path)); assert.ok(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink());
  const actual = realpathSync(path), within = relative(output, actual);
  assert.ok(within !== "" && !within.startsWith(`..${sep}`) && within !== ".." && !isAbsolute(within));
  assert.equal(statSync(actual).mode & 0o077, 0, "Private evidence must remain owner-only");
  return JSON.parse(readFileSync(actual, "utf8"));
}
function bindSource(label: "before" | "after"): Binding {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", env: gitEnv }).trim();
  const buffer = execFileSync("python3", [join(root, "ci/financial-review/source-binding.py"), root, result.sourceHead],
    { cwd: root, env: gitEnv, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  const binding = JSON.parse(buffer.toString("utf8")) as Binding;
  assert.equal(binding.commit, result.sourceHead); assert.match(binding.tree, /^[0-9a-f]{40}$/);
  assert.ok(binding.fileCount > 0); assert.match(binding.sourceFingerprint, /^[0-9a-f]{64}$/);
  assert.match(binding.objectInventorySha256, /^[0-9a-f]{64}$/);
  writeFileSync(join(evidence, `source-binding-${label}.json`), buffer, { mode: 0o600, flag: "wx" });
  return binding;
}
async function portOccupied(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port: 3000 }); socket.setTimeout(750);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); reject(new Error("PortProbeTimeout")); });
    socket.once("error", error => { socket.destroy();
      if ((error as NodeJS.ErrnoException).code === "ECONNREFUSED") resolve(false);
      else reject(new Error("PortProbeFailure"));
    });
  });
}
function processIdentity(pid: number) {
  const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
  const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ");
  return { group: Number(fields[2]), startTicks: fields[19] };
}
async function stopOwnedServer() {
  const owned = server; if (!owned) return; server = null;
  const signal = (name: NodeJS.Signals) => {
    if (owned.exited) return;
    try {
      const current = processIdentity(owned.pid);
      assert.equal(current.group, owned.pid, "Refusing a process outside the owned group");
      assert.equal(current.startTicks, owned.startTicks, "Refusing a reused process identity");
      process.kill(-owned.pid, name);
    } catch (error) { if (!["ENOENT", "ESRCH"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error; }
  };
  signal("SIGTERM");
  const deadline = Date.now() + 20_000;
  while ((!owned.exited || await portOccupied()) && Date.now() < deadline) await pause(100);
  if (!owned.exited) {
    result.forcedStops++; signal("SIGKILL");
    const deadline = Date.now() + 5_000;
    while ((!owned.exited || await portOccupied()) && Date.now() < deadline) await pause(100);
  } else result.gracefulStops++;
  assert.equal(owned.exited, true, "Owned process did not exit");
  assert.equal(await portOccupied(), false, "Owned process did not release the loopback port");
}
async function startOwnedServer(label: string, night: boolean, shilla: boolean, databaseUrl: string, authSecret: string) {
  assert.equal(interrupted, false); assert.equal(server, null);
  assert.equal(await portOccupied(), false, "Refusing an existing listener");
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  for (const name of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
    "http_proxy", "https_proxy", "all_proxy", "no_proxy", "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS"]) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  Object.assign(env, { NODE_ENV: "production", CI: "true", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: databaseUrl,
    DATABASE_POOL_MAX: "4", APP_URL: origin, AUTH_RATE_LIMIT_SECRET: authSecret, TRUST_PROXY: "false",
    ENABLE_NIGHT_OF_QUDDAM: String(night), ENABLE_SHILLATAK: String(shilla) });
  const fd = openSync(join(evidence, `${label}.server.private.log`), "wx", 0o600);
  let child: ChildProcess;
  try {
    // A policy rejection or startup failure stops this test; no alternative launcher is attempted.
    child = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3000"],
      { cwd: process.cwd(), env, detached: true, stdio: ["ignore", fd, fd] });
  } finally { closeSync(fd); }
  assert.ok(child.pid); const identity = processIdentity(child.pid);
  assert.equal(identity.group, child.pid);
  const owned = { child, pid: child.pid, startTicks: identity.startTicks, exited: false };
  child.once("exit", () => { owned.exited = true; }); child.once("error", () => { owned.exited = true; });
  server = owned; result.processesStarted++;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    assert.equal(interrupted, false); assert.equal(owned.exited, false, "Owned built server exited before readiness");
    try {
      const response = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(3_000) });
      await response.arrayBuffer(); if (response.status === 200) { result.realBuiltNextProcesses = true; return; }
    } catch { /* Raw startup output is retained in owner-only external logs. */ }
    await pause(250);
  }
  throw new Error("BuiltServerReadinessTimeout");
}
function observe(context: BrowserContext) {
  context.on("page", page => {
    page.on("pageerror", () => result.observations.pageExceptions++);
    page.on("console", message => {
      if (message.type() !== "error") return;
      result.observations.consoleErrors++;
      const status = message.text().match(/Failed to load resource:.*status of (\d{3})/i)?.[1];
      const category = status ? `http-${status}` : /hydration|Minified React error #(?:418|423|425)/i.test(message.text()) ? "hydration" : "other-redacted";
      result.observations.consoleErrorCategories[category] = (result.observations.consoleErrorCategories[category] ?? 0) + 1;
    });
    page.on("request", request => {
      const url = new URL(request.url());
      if (["http:", "https:"].includes(url.protocol) && url.origin !== origin) result.observations.externalBrowserRequests++;
    });
    page.on("requestfailed", request => {
      result.observations.failedRequests++;
      const raw = request.failure()?.errorText ?? "UNKNOWN";
      const category = /^net::ERR_[A-Z_]+$/.test(raw) ? raw : "OTHER_REDACTED";
      result.observations.failedRequestCategories[category] = (result.observations.failedRequestCategories[category] ?? 0) + 1;
    });
  });
}
async function browserHttp(page: Page, path: string, method = "GET") {
  const response = await page.evaluate(async ({ path, method }) => {
    const response = await fetch(path, { method, cache: "no-store", credentials: "same-origin",
      signal: AbortSignal.timeout(30_000), ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: "{}" } : {}) });
    const json = response.headers.get("content-type")?.includes("application/json");
    const body = json ? await response.json() : (await response.arrayBuffer(), null);
    return { status: response.status, body,
      cache: response.headers.get("cache-control"), referrer: response.headers.get("referrer-policy") };
  }, { path, method });
  if (method === "POST" && response.status >= 200 && response.status < 300) result.successfulWriteRequests++;
  return response;
}
async function persistedSnapshot(ownerId: string, nightId: string, groupId: string) {
  return db().$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const [night, group, wallet, credits] = await Promise.all([
      tx.nightSession.findUniqueOrThrow({ where: { id: nightId }, include: { games: { orderBy: { position: "asc" } },
        commands: { orderBy: { id: "asc" } }, invitation: { include: { guests: { orderBy: { id: "asc" } } } } } }),
      tx.shilla.findUniqueOrThrow({ where: { id: groupId }, include: { teams: { orderBy: { position: "asc" } },
        members: { orderBy: { id: "asc" } }, invites: { orderBy: { id: "asc" } }, nights: { orderBy: { id: "asc" } } } }),
      tx.creditWallet.findUniqueOrThrow({ where: { userId: ownerId } }),
      tx.gameCredit.findMany({ where: { userId: ownerId }, orderBy: { id: "asc" } }),
    ]);
    assert.equal(night.ownerId, ownerId); assert.equal(group.ownerId, ownerId);
    assert.equal(night.phase, "completed"); assert.equal(group.nights.length, 1);
    assert.equal(group.nights[0].nightId, nightId);
    const ids = night.games.flatMap(slot => slot.sourceSessionId ? [slot.sourceSessionId] : []);
    const [sessions, teams, commands, scoreEvents] = await Promise.all([
      tx.gameSession.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } }),
      tx.team.findMany({ where: { sessionId: { in: ids } }, orderBy: { id: "asc" } }),
      tx.gameCommand.findMany({ where: { sessionId: { in: ids } }, orderBy: { id: "asc" } }),
      tx.scoreEvent.findMany({ where: { sessionId: { in: ids } }, orderBy: { id: "asc" } }),
    ]);
    return sha256({ night, group, wallet, credits, sessions, teams, commands, scoreEvents });
  }, { timeout: 20_000 });
}

async function main() {
  assert.equal(process.platform, "linux"); output = isolatedEnvironment().output;
  const run = process.env.BETA_RESTART_RUN ?? "beta-restart"; assert.match(run, /^[a-zA-Z0-9_-]{1,100}$/);
  evidence = join(output, run); mkdirSync(evidence, { mode: 0o700 }); checkpoint();
  const expected = process.env.BETA_EXPECTED_SHA; assert.match(expected ?? "", /^[0-9a-f]{40}$/, "A literal dispatched SHA is required");
  result.sourceHead = expected!;
  step = "literal-source-binding-before"; checkpoint();
  const beforeBinding = bindSource("before");
  result.sourceTree = beforeBinding.tree; result.sourceInventoryBefore = beforeBinding.sourceFingerprint;
  result.sourceObjectsBefore = beforeBinding.objectInventorySha256; result.sourceFileCount = beforeBinding.fileCount;
  check("literal-dispatched-source-commit-bytes-modes-and-inventory-match-before-testing");
  databaseOpened = true; const fixture = await loadFixture();
  const version = await db().$queryRaw<{ version: string }[]>`SELECT version() AS version`;
  assert.match(version[0].version, /^PostgreSQL 17\./);
  result.nativePostgres17 = true;
  for (const file of [".env", ".env.local", ".env.production", ".env.production.local"])
    assert.equal(existsSync(join(process.cwd(), file)), false, "Implicit dotenv loading is prohibited");
  const buildFile = join(process.cwd(), ".next/BUILD_ID"); assert.equal(existsSync(buildFile), true);
  result.buildIdSha256 = createHash("sha256").update(readFileSync(buildFile)).digest("hex");
  const nightRun = process.env.BETA_NIGHT_RUN, shillaRun = process.env.BETA_SHILLA_RUN;
  assert.match(nightRun ?? "", /^[a-zA-Z0-9_-]{1,100}$/); assert.match(shillaRun ?? "", /^[a-zA-Z0-9_-]{1,100}$/);
  for (const previous of [nightRun!, shillaRun!]) {
    const receipt = privateFile(join(output, previous, "receipt.json")) as { sourceHead: string; sourceDirty: boolean; status: string };
    assert.equal(receipt.sourceHead, result.sourceHead); assert.equal(receipt.sourceDirty, false);
    assert.equal(receipt.status, "PASSED", "Successful same-head Chrome evidence is required");
  }
  const nightJourney = privateFile(join(output, nightRun!, "journey.private.json")) as { ownerId: string; nightId: string };
  const groupJourney = privateFile(join(output, shillaRun!, "journey.private.json")) as PrivateJourney;
  assert.equal(nightJourney.ownerId, fixture.ownerId); assert.equal(groupJourney.ownerId, fixture.ownerId);
  assert.equal(groupJourney.nightId, nightJourney.nightId);
  assert.match(groupJourney.groupId, /^[0-9a-f-]{36}$/); assert.match(nightJourney.nightId, /^[0-9a-f-]{36}$/);
  assert.match(groupJourney.invitePath, /^\/shillatak\/join\/[0-9a-f]{64}$/);
  const nightInvitation = privateFile(join(output, nightRun!, "invitation.private.json")) as { path: string };
  assert.match(nightInvitation.path, /^\/night\/invite\/[0-9a-f]{64}$/);
  const cookies = privateFile(join(output, shillaRun!, "owner-cookies.private.json")) as Parameters<BrowserContext["addCookies"]>[0];
  assert.ok(Array.isArray(cookies)); const ownerCookies = cookies.filter(cookie => cookie.name === "qalba_session");
  assert.equal(ownerCookies.length, 1);
  assert.ok(ownerCookies.every(cookie => cookie.domain === "127.0.0.1" && cookie.path === "/" && cookie.httpOnly && cookie.secure && cookie.sameSite === "Lax"));
  const executablePath = process.env.CHROME_EXECUTABLE; assert.ok(executablePath && isAbsolute(executablePath));
  result.browser = execFileSync(executablePath, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  assert.match(result.browser, /^Google Chrome/); result.sandboxDisabled = process.env.NIGHT_MVP_CHROME_NO_SANDBOX === "1";
  assert.equal(await portOccupied(), false, "An existing listener must be stopped by its owner first");
  const databaseUrl = process.env.DATABASE_URL; assert.ok(databaseUrl);
  const secret = randomBytes(32).toString("hex");
  const before = await persistedSnapshot(fixture.ownerId, nightJourney.nightId, groupJourney.groupId);
  browser = await chromium.launch({ executablePath, headless: true, ...(result.sandboxDisabled ? { args: ["--no-sandbox"] } : {}) });
  result.realChrome = browser.isConnected(); assert.equal(result.realChrome, true);
  const ownerContext = async () => {
    assert.ok(browser); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Riyadh" });
    await context.addCookies(ownerCookies); observe(context); return context;
  };
  let baselineGroup: ShillaView | null = null, baselineNight: NightView | null = null;
  for (const label of ["first-enabled", "second-enabled"]) {
    step = label; checkpoint(); await startOwnedServer(label, true, true, databaseUrl, secret);
    const owner = await ownerContext(), page = await owner.newPage();
    assert.equal((await page.goto(`${origin}/shillatak/${groupJourney.groupId}`))?.status(), 200);
    await expect(page.getByTestId("shillatak-group")).toBeVisible();
    await expect(page.getByTestId("shilla-leaderboard").locator("tbody tr")).toHaveCount(2);
    const groupRead = await browserHttp(page, `/api/shillatak/${groupJourney.groupId}`);
    assert.equal(groupRead.status, 200); assert.ok(groupRead.cache?.includes("no-store"));
    const group = groupRead.body.shilla as ShillaView;
    assert.equal(group.owner, true); assert.equal(group.myRole, "OWNER"); assert.equal(group.nights.length, 1);
    assert.equal(group.members.length, 1); assert.equal(group.members[0].role, "OWNER");
    assert.ok(group.leaderboard.every(team => team.played === 1));
    assert.equal(group.activeInvites.length, 0); assert.equal(group.eligibleNights.length, 0);
    const forbidden = /"(?:ownerId|userId|tokenHash|capabilityHash|sourceSessionId|resultReceipt|sourceDigest|email|invitePath|path)"\s*:/;
    assert.equal(forbidden.test(JSON.stringify(group)), false);
    if (baselineGroup) assert.deepEqual(group, baselineGroup); else baselineGroup = group;
    check(`${label}-owner-membership-private-leaderboard-history-and-safe-projection-restored`);
    assert.equal((await page.goto(`${origin}/night/${nightJourney.nightId}`))?.status(), 200);
    await expect(page.getByTestId("night-dashboard")).toHaveAttribute("data-phase", "completed");
    await expect(page.getByTestId("night-highlights")).toBeVisible();
    const nightRead = await browserHttp(page, `/api/night/${nightJourney.nightId}`);
    assert.equal(nightRead.status, 200); const night = nightRead.body.night as NightView;
    assert.equal(night.phase, "completed"); assert.equal(night.results.length, 3);
    if (baselineNight) assert.deepEqual(night, baselineNight); else baselineNight = night;
    check(`${label}-all-three-trusted-night-results-and-highlights-restored`);
    const png = await page.evaluate(async path => {
      const response = await fetch(path, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(30_000) });
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { status: response.status, signature: [...bytes.slice(0, 8)],
        width: bytes.length >= 24 ? new DataView(bytes.buffer).getUint32(16) : null,
        height: bytes.length >= 24 ? new DataView(bytes.buffer).getUint32(20) : null,
        cache: response.headers.get("cache-control") };
    }, `/api/night/${nightJourney.nightId}/share-card`);
    assert.equal(png.status, 200); assert.deepEqual(png.signature, [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.width, 1200); assert.equal(png.height, 630); assert.ok(png.cache?.includes("no-store"));
    check(`${label}-actual-private-1200x630-png-survives-fresh-built-process`);
    const memberPreview = await browserHttp(page, groupJourney.invitePath.replace("/shillatak/join/", "/api/shillatak/join/"));
    assert.equal(memberPreview.status, 200); assert.equal(memberPreview.body.invitation.alreadyMember, true);
    assert.equal(memberPreview.body.invitation.shillaId, groupJourney.groupId);
    check(`${label}-existing-owner-membership-recognized-without-reissuing-secret-or-consuming-invite`);
    await owner.close(); await stopOwnedServer(); check(`${label}-owned-built-process-exited-and-loopback-port-released`);
    assert.equal(await persistedSnapshot(fixture.ownerId, nightJourney.nightId, groupJourney.groupId), before);
  }
  check("two-fresh-built-processes-preserve-source-results-shilla-history-invites-memberships-wallet-and-ledger");
  const shillaRoutes: [string, string, string][] = [
    ["shilla-home", "/shillatak", "GET"], ["shilla-group-page", `/shillatak/${groupJourney.groupId}`, "GET"],
    ["shilla-join-page", groupJourney.invitePath, "GET"], ["shilla-list-api", "/api/shillatak", "GET"],
    ["shilla-detail-api", `/api/shillatak/${groupJourney.groupId}`, "GET"],
    ["shilla-preview-api", groupJourney.invitePath.replace("/shillatak/join/", "/api/shillatak/join/"), "GET"],
    ["shilla-create-api", "/api/shillatak", "POST"], ["shilla-command-api", `/api/shillatak/${groupJourney.groupId}`, "POST"],
    ["shilla-join-api", groupJourney.invitePath.replace("/shillatak/join/", "/api/shillatak/join/"), "POST"],
  ];
  const nightRoutes: [string, string][] = [
    ["night-home", "/night"], ["night-new", "/night/new"], ["night-saved", `/night/${nightJourney.nightId}`],
    ["night-invitation-page", nightInvitation.path], ["night-api", `/api/night/${nightJourney.nightId}`],
    ["night-invitation-api", `/api/night/${nightJourney.nightId}/invitation`],
    ["night-public-invitation-api", nightInvitation.path.replace("/night/invite/", "/api/night/invite/")],
    ["night-highlights-api", `/api/night/${nightJourney.nightId}/highlights`],
    ["night-share-card-api", `/api/night/${nightJourney.nightId}/share-card`],
  ];
  const variants = [{ label: "night-on-shilla-off", night: true, shilla: false },
    { label: "night-off-shilla-on", night: false, shilla: true }, { label: "both-off", night: false, shilla: false }];
  for (const variant of variants) {
    step = variant.label; checkpoint(); await startOwnedServer(variant.label, variant.night, variant.shilla, databaseUrl, secret);
    const owner = await ownerContext(), page = await owner.newPage();
    assert.equal((await page.goto(`${origin}/games`))?.status(), 200);
    await expect(page.locator(".games-grid .game-card")).toHaveCount(10);
    await expect(page.locator('a[href="/shillatak"]')).toHaveCount(0);
    if (!variant.night) await expect(page.locator('a[href="/night"], a[href="/night/new"]')).toHaveCount(0);
    check(`${variant.label}-original-ten-game-library-remains-available-without-disabled-feature-entry`);
    for (const [route, path, method] of shillaRoutes) {
      const response = await browserHttp(page, path, method);
      result.statusChecks.push({ variant: variant.label, route, method, status: response.status, expected: 404 });
      assert.equal(response.status, 404); assert.ok(response.cache?.includes("no-store"));
    }
    check(`${variant.label}-authenticated-shilla-pages-preview-and-all-write-entry-points-return-404`);
    for (const [route, path] of nightRoutes) {
      const response = await browserHttp(page, path);
      result.statusChecks.push({ variant: variant.label, route, method: "GET", status: response.status, expected: variant.night ? 200 : 404 });
      assert.equal(response.status, variant.night ? 200 : 404);
    }
    check(`${variant.label}-night-invitation-highlights-and-card-gates-follow-night-flag-independently`);
    if (!variant.night) {
      for (const path of ["/api/night", `/api/night/${nightJourney.nightId}/commands`,
        `/api/night/${nightJourney.nightId}/invitation`, nightInvitation.path.replace("/night/invite/", "/api/night/invite/")]) {
        const response = await browserHttp(page, path, "POST"); assert.equal(response.status, 404);
      }
      check(`${variant.label}-disabled-night-posts-denied-before-mutation`);
    }
    assert.ok(browser); const anonymous = await browser.newContext(); observe(anonymous);
    const guest = await anonymous.newPage(); await guest.goto(`${origin}/login`);
    for (const [route, path, method] of shillaRoutes.filter(([, path]) => path.startsWith("/api/"))) {
      const response = await browserHttp(guest, path, method); assert.equal(response.status, 404);
      result.statusChecks.push({ variant: variant.label, route: `anonymous-${route}`, method, status: response.status, expected: 404 });
    }
    check(`${variant.label}-anonymous-shilla-reads-and-writes-denied-before-authentication-or-data-access`);
    await anonymous.close(); await owner.close(); await stopOwnedServer();
    assert.equal(await persistedSnapshot(fixture.ownerId, nightJourney.nightId, groupJourney.groupId), before);
    check(`${variant.label}-all-denied-posts-preserve-results-invites-memberships-wallet-and-ledger`);
  }
  assert.equal(result.observations.pageExceptions, 0); check("no-unhandled-real-chrome-page-exceptions");
  assert.equal(result.observations.consoleErrorCategories.hydration ?? 0, 0);
  assert.equal(result.observations.consoleErrorCategories["other-redacted"] ?? 0, 0);
  check("no-hydration-or-unclassified-browser-console-errors-expected-http-denials-counted-separately");
  assert.ok(Object.keys(result.observations.failedRequestCategories).every(category => category === "net::ERR_ABORTED"));
  check("no-unexpected-transport-failures-navigation-or-context-close-aborts-counted-separately");
  assert.equal(result.observations.externalBrowserRequests, 0); check("no-browser-requests-to-external-services");
  assert.equal(result.successfulWriteRequests, 0); check("all-http-post-probes-were-denied-without-successful-write-responses");
  assert.equal(result.processesStarted, 5); assert.equal(result.gracefulStops, 5); assert.equal(result.forcedStops, 0);
  check("all-five-owned-built-runtime-processes-stop-gracefully-without-touching-existing-listeners");
  assert.equal(createHash("sha256").update(readFileSync(buildFile)).digest("hex"), result.buildIdSha256);
  check("same-existing-build-identity-remains-unchanged-across-the-five-owned-processes");
  step = "literal-source-binding-after"; checkpoint();
  const afterBinding = bindSource("after");
  result.sourceInventoryAfter = afterBinding.sourceFingerprint; result.sourceObjectsAfter = afterBinding.objectInventorySha256;
  assert.equal(afterBinding.tree, result.sourceTree); assert.equal(afterBinding.fileCount, result.sourceFileCount);
  assert.equal(result.sourceInventoryAfter, result.sourceInventoryBefore); assert.equal(result.sourceObjectsAfter, result.sourceObjectsBefore);
  check("literal-dispatched-source-bytes-modes-objects-and-inventory-unchanged-after-tests");
  checksComplete = true; step = "cleanup"; checkpoint();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
  interrupted = true; failureClass = "Interrupted"; process.exitCode = signal === "SIGINT" ? 130 : 143;
  // Closing Chrome interrupts pending browser work; normal finally owns server cleanup.
  void browser?.close().catch(() => {});
});
main().catch(error => {
  failureClass ??= error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name) ? error.name : "UnknownError";
  result.status = "FAILED"; process.exitCode = 1;
}).finally(async () => {
  try { await browser?.close(); } catch { failureClass ??= "BrowserCleanupError"; }
  try { await stopOwnedServer(); } catch { failureClass ??= "ServerCleanupError"; }
  if (databaseOpened) try { await db().$disconnect(); } catch { failureClass ??= "DatabaseCleanupError"; }
  result.status = checksComplete && !failureClass && !interrupted ? "PASSED" : "FAILED";
  if (result.status !== "PASSED") process.exitCode ||= 1;
  result.finishedAt = new Date().toISOString();
  const receipt = { ...result, step, failureClass, passed: result.checks.length,
    failed: result.status === "PASSED" ? 0 : 1, privateValuesWithheld: true };
  if (evidence) writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ status: receipt.status, passed: receipt.passed, failed: receipt.failed,
    failureStep: receipt.status === "PASSED" ? null : step, failureClass }));
});
