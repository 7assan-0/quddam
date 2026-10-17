/** Real Chrome + HTTP Shillatak acceptance against the guarded synthetic PG17 fixture.
 * Requires the completed real engine journey in BETA_NIGHT_RUN (not PR12 evidence).
 * No server or database writes outside normal browser/API actions are performed here.
 * A labelled fault probe aborts one response only AFTER the actual accept POST commits.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID, createHash } from "node:crypto";
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
const output = process.env.NIGHT_MVP_OUTPUT;
assert.ok(output && isAbsolute(output));
assert.ok(relative(process.cwd(), realpathSync(output)).startsWith(".."));
const origin = new URL(process.env.BASE_URL ?? "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname));
assert.equal(origin.pathname, "/");
const run = process.env.BETA_SHILLATAK_CHROME_RUN ?? "beta-shillatak-chrome";
const nightRun = process.env.BETA_NIGHT_RUN;
assert.match(run, /^[a-z0-9_-]+$/);
assert.match(nightRun ?? "", /^[a-z0-9_-]+$/);
const evidence = join(output, run);
mkdirSync(evidence, { mode: 0o700 }); // Never overwrite earlier evidence.
const fixture = JSON.parse(readFileSync(join(output, "fixture.private.json"), "utf8"));
const login = JSON.parse(readFileSync(join(output, "phase4-auth.private.json"), "utf8"));
const journey = JSON.parse(readFileSync(join(output, nightRun, "journey.private.json"), "utf8"));
const nightReceipt = JSON.parse(readFileSync(join(output, nightRun, "receipt.json"), "utf8"));
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(nightReceipt.sourceHead, sourceHead, "Run the original engines against this same source head first");
assert.equal(nightReceipt.status, "PASSED", "The new source's complete Night browser journey is prerequisite");
assert.ok(journey.ownerId === fixture.ownerId, "Guarded owner fixture must match");
const executablePath = process.env.CHROME_EXECUTABLE;
assert.ok(executablePath && isAbsolute(executablePath));
const chromeVersion = execFileSync(executablePath, ["--version"], { encoding: "utf8" }).trim();
assert.match(chromeVersion, /^Google Chrome/);
const pool = new Pool({ connectionString: config.DATABASE_URL, max: 2 });
const result = { schemaVersion: 1, sourceHead,
  sourceTree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
  sourceDirty: execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim().length > 0,
  browser: chromeVersion, headless: true, realHttp: true, localhostOnly: true, syntheticOnly: true,
  normalJourneyMockedResponses: false, transportFaultInjection: true,
  faultDescription: "One real acceptance response is aborted after the actual HTTP POST commits; no fabricated backend responses.",
  startedAt: new Date().toISOString(), checks: [],
  observations: { pageExceptions: 0, consoleErrors: 0, consoleErrorCategories: {}, failedRequests: 0,
    failedRequestCategories: {}, externalBrowserRequests: 0 },
};
let browser, activePage, step = "database-identity", transportFaultActive = false;
const check = (name, value = true) => { assert.ok(value, name); result.checks.push({ name, passed: true }); };
const checkpoint = () => writeFileSync(join(evidence, "progress.json"), JSON.stringify({ ...result, currentStep: step }), { mode: 0o600 });
const sql = async (query, values = []) => (await pool.query(query, values)).rows;
const privateSave = (file, value) => writeFileSync(join(evidence, file), JSON.stringify(value), { flag: "wx", mode: 0o600 });
function observe(page) {
  page.on("pageerror", () => result.observations.pageExceptions++);
  page.on("console", message => {
    if (message.type() !== "error") return;
    result.observations.consoleErrors++;
    const status = message.text().match(/Failed to load resource:.*status of (\d{3})/i)?.[1];
    const category = status ? `http-${status}` : /hydration|Minified React error #(?:418|423|425)/i.test(message.text()) ? "hydration" :
      transportFaultActive && /net::ERR_CONNECTION_RESET/.test(message.text()) ? "injected-connection-reset" : "other-redacted";
    result.observations.consoleErrorCategories[category] = (result.observations.consoleErrorCategories[category] ?? 0) + 1;
  });
  page.on("request", request => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== origin.origin) result.observations.externalBrowserRequests++;
  });
  page.on("requestfailed", request => {
    result.observations.failedRequests++;
    const raw = request.failure()?.errorText ?? "UNKNOWN";
    const category = /^net::ERR_[A-Z_]+$/.test(raw) ? raw : "OTHER_REDACTED";
    const path = new URL(request.url()).pathname;
    const scope = request.headers().rsc === "1" ? "next-rsc" : path.startsWith("/_next/") ? "next-internal" :
      path.startsWith("/api/shillatak/") ? "shillatak-api" : path.startsWith("/api/auth/") ? "auth-api" : "other";
    const key = `${scope}:${request.method()}:${request.resourceType()}:${category}`;
    result.observations.failedRequestCategories[key] = (result.observations.failedRequestCategories[key] ?? 0) + 1;
  });
}
async function browserHttp(page, path, { method = "GET", data } = {}) {
  return page.evaluate(async ({ path, method, data }) => {
    const response = await fetch(path, { method, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15_000),
      headers: { ...(data !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
    return { status: response.status, headers: Object.fromEntries(response.headers),
      body: response.headers.get("content-type")?.includes("application/json") ? await response.json() : null };
  }, { path, method, data });
}
async function boundedJson(response) {
  let timer;
  try { return await Promise.race([response.json(), new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("BROWSER_RESPONSE_BODY_TIMEOUT")), 15_000);
  })]); }
  finally { clearTimeout(timer); }
}
async function clickMutation(page, button, path, status = 200, { readJson = true } = {}) {
  await expect(button).toBeEnabled();
  const pending = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === path, { timeout: 15_000 });
  void pending.catch(() => {}); // A click failure must not leave an unhandled token-bearing browser rejection.
  await button.click(); const response = await pending;
  result.lastUiStatus = { step, operation: path.endsWith("/logout") ? "auth-logout" : path.endsWith("/login") ? "auth-login" :
    path.endsWith("/register") ? "auth-register" : "shillatak", actual: response.status(), expected: status };
  checkpoint();
  assert.equal(response.status(), status, `UI command status at ${step}`);
  return readJson ? boundedJson(response) : null;
}
async function groupView(page, id) {
  const response = await browserHttp(page, `/api/shillatak/${id}`);
  assert.equal(response.status, 200); return response.body.shilla;
}
async function wallet() { return (await sql('SELECT "balance" FROM "CreditWallet" WHERE "userId"=$1', [fixture.ownerId]))[0].balance; }
async function checkMobile(page, label) {
  const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
    rtl: document.documentElement.dir, lang: document.documentElement.lang }));
  check(`${label}-mobile-rtl-no-horizontal-overflow`, layout.rtl === "rtl" && layout.lang === "ar" && layout.scroll <= layout.width + 1);
}
async function readPrivateProjection(page, id, nightId) {
  const response = await browserHttp(page, `/api/shillatak/${id}`);
  assert.equal(response.status, 200);
  const view = response.body.shilla;
  assert.equal(view.owner, false); assert.deepEqual(view.activeInvites, []); assert.deepEqual(view.eligibleNights, []);
  const encoded = JSON.stringify(view);
  assert.doesNotMatch(encoded, /ownerId|userId|tokenHash|sourceSessionId|resultReceipt|sourceDigest|hostCapability/);
  assert.equal(encoded.includes(nightId), false);
  return view;
}
try {
  const identity = await sql("SELECT current_database() AS database, version() AS version");
  assert.equal(identity[0].database, database.pathname.slice(1)); assert.match(identity[0].version, /^PostgreSQL 17\./);
  const marker = await sql('SELECT "config" FROM "FeatureFlag" WHERE "key"=$1', ["night-mvp-synthetic-fixture"]);
  assert.equal(marker[0].config.run, fixture.run);
  const night = (await sql('SELECT "ownerId","phase","state" FROM "NightSession" WHERE "id"=$1', [journey.nightId]))[0];
  assert.equal(night.ownerId, fixture.ownerId); assert.equal(night.phase, "completed"); assert.equal(night.state.results.length, 3);
  const teams = night.state.teams.map(team => team.name);
  const totals = night.state.teams.map(team => night.state.totals[team.id]);
  const before = await wallet();
  const ledgerBefore = (await sql('SELECT count(*)::int AS n FROM "GameCredit" WHERE "userId"=$1', [fixture.ownerId]))[0].n;
  const sandboxDisabled = process.env.NIGHT_MVP_CHROME_NO_SANDBOX === "1";
  result.sandboxDisabled = sandboxDisabled;
  browser = await chromium.launch({ executablePath, headless: true, ...(sandboxDisabled ? { args: ["--no-sandbox"] } : {}) });
  const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Riyadh",
    permissions: ["clipboard-read", "clipboard-write"] });
  ownerContext.setDefaultTimeout(15_000); ownerContext.setDefaultNavigationTimeout(15_000);
  const owner = await ownerContext.newPage(); observe(owner);
  step = "owner-login-and-library-entry"; checkpoint();
  await owner.goto(new URL("/login", origin).href);
  await owner.locator("#email").fill(login.email); await owner.locator("#password").fill(login.password);
  await clickMutation(owner, owner.getByRole("button", { name: "تسجيل الدخول", exact: true }), "/api/auth/login");
  await owner.waitForURL(new URL("/games", origin).href);
  await owner.locator(".library-balance").getByRole("link", { name: "شلّتك", exact: true }).click();
  await expect(owner.getByTestId("shillatak-home")).toBeVisible(); check("real-owner-login-and-library-shillatak-entry");
  step = "owner-create-rtl-group-with-night-teams"; checkpoint();
  const groupName = "شلّة قبول بيتا الاصطناعية لاختبار الأصدقاء";
  await owner.locator("#shilla-name").fill(groupName);
  await owner.locator("#shilla-team-a").fill(teams[0]); await owner.locator("#shilla-team-b").fill(teams[1]);
  const created = await clickMutation(owner, owner.getByRole("button", { name: "إنشاء الشلّة", exact: true }), "/api/shillatak", 201);
  const id = created.shilla.id, endpoint = `/api/shillatak/${id}`;
  privateSave("group.private.json", { groupId: id, ownerId: fixture.ownerId, nightId: journey.nightId });
  await owner.locator(`a[href="/shillatak/${id}"]`).click(); await expect(owner.getByTestId("shillatak-group")).toBeVisible();
  check("owner-created-private-group-with-same-two-stable-night-teams"); check("group-create-did-not-debit-credit", await wallet() === before);
  const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Riyadh" });
  anonymous.setDefaultTimeout(15_000); anonymous.setDefaultNavigationTimeout(15_000);
  const anonymousPage = await anonymous.newPage(); observe(anonymousPage);
  activePage = anonymousPage;
  const anonymousGroup = await anonymous.request.get(new URL(endpoint, origin).href);
  check("anonymous-private-group-read-denied", anonymousGroup.status() === 401);
  const outsiderContext = await browser.newContext();
  outsiderContext.setDefaultTimeout(15_000); outsiderContext.setDefaultNavigationTimeout(15_000);
  await outsiderContext.addCookies([{ name: "qalba_session", value: fixture.otherOwnerToken,
    url: origin.origin, httpOnly: true, sameSite: "Lax" }]);
  const outsider = await outsiderContext.newPage(); observe(outsider); await outsider.goto(new URL("/games", origin).href);
  const outsiderRead = await browserHttp(outsider, endpoint);
  check("authenticated-nonmember-cannot-read-private-group", outsiderRead.status === 404 && !JSON.stringify(outsiderRead.body).includes(groupName));
  step = "one-time-invite-and-immediate-revocation-metadata"; checkpoint();
  let invite = await clickMutation(owner, owner.getByRole("button", { name: "إنشاء رابط عضوية", exact: true }), endpoint, 201);
  const invitationPath = invite.invitation.path;
  privateSave("invitation.private.json", { path: invitationPath });
  await expect(owner.getByRole("button", { name: "إلغاء الدعوة", exact: true })).toHaveCount(1);
  await expect(owner.locator("#shilla-new-link")).toHaveValue(new URL(invitationPath, origin).href);
  await owner.getByRole("button", { name: "نسخ الرابط", exact: true }).click();
  await expect.poll(() => owner.evaluate(() => navigator.clipboard.readText())).toBe(new URL(invitationPath, origin).href);
  check("newly-issued-single-use-invite-is-immediately-listed-and-copied");
  const code = invitationPath.split("/").at(-1);
  const persisted = await sql('SELECT "tokenHash" FROM "ShillaInvite" WHERE "shillaId"=$1', [id]);
  assert.equal(persisted.length, 1); assert.equal(persisted[0].tokenHash, createHash("sha256").update(code).digest("hex"));
  assert.notEqual(persisted[0].tokenHash, code); check("postgres-persists-hash-not-raw-invitation");
  await owner.reload(); await expect(owner.getByRole("button", { name: "إلغاء الدعوة", exact: true })).toHaveCount(1);
  await expect(owner.locator("#shilla-new-link")).toHaveCount(0);
  await expect(owner.getByTestId("shillatak-group")).toContainText("Asia/Riyadh");
  check("active-invite-owner-reload-hydrates-in-browser-zone-and-hides-one-time-url");
  const document = await anonymousPage.goto(new URL(invitationPath, origin).href);
  const headers = document.headers();
  check("join-document-no-store-no-referrer-noindex", headers["cache-control"].includes("no-store") &&
    headers["referrer-policy"] === "no-referrer" && headers["x-robots-tag"].includes("noindex"));
  await expect(anonymousPage.getByTestId("shillatak-join-auth")).toBeVisible();
  check("signed-out-invite-keeps-inline-auth-and-hides-private-group-name", !await anonymousPage.locator("body").innerText().then(text => text.includes(groupName)));
  await checkMobile(anonymousPage, "inline-invitation-authentication");
  step = "inline-registration-return-and-explicit-single-use-acceptance"; checkpoint();
  const memberCredentials = { name: "عضو رحلة بيتا الاصطناعي", email: `beta-browser-${randomUUID()}@example.test`,
    password: randomBytes(24).toString("base64url") };
  privateSave("member-auth.private.json", memberCredentials);
  await anonymousPage.getByTestId("shillatak-join-auth").getByRole("button", { name: "حساب جديد", exact: true }).click();
  await anonymousPage.locator("#name").fill(memberCredentials.name);
  await anonymousPage.locator("#email").fill(memberCredentials.email); await anonymousPage.locator("#password").fill(memberCredentials.password);
  await clickMutation(anonymousPage, anonymousPage.getByRole("button", { name: "إنشاء الحساب", exact: true }), "/api/auth/register", 201);
  await expect(anonymousPage.getByTestId("shillatak-join")).toBeVisible();
  await expect(anonymousPage).toHaveURL(new URL(invitationPath, origin).href);
  await expect(anonymousPage.getByRole("button", { name: "قبول الدعوة", exact: true })).toBeVisible();
  const membershipBeforeAccept = (await sql('SELECT count(*)::int AS n FROM "ShillaMembership" WHERE "shillaId"=$1', [id]))[0].n;
  check("inline-register-returns-to-invite-without-auto-accepting-membership", membershipBeforeAccept === 1);
  const joinEndpoint = invitationPath.replace("/shillatak/join/", "/api/shillatak/join/");
  const wrongOrigin = await anonymous.request.post(new URL(joinEndpoint, origin).href,
    { headers: { Origin: "https://untrusted.example.test" } });
  check("cross-origin-acceptance-rejected-before-consumption", wrongOrigin.status() === 403);
  const forged = await browserHttp(anonymousPage, joinEndpoint, { method: "POST", data: { host: true, ownerId: fixture.ownerId } });
  check("extra-authority-join-fields-rejected-before-consumption", forged.status === 400);
  await clickMutation(anonymousPage, anonymousPage.getByRole("button", { name: "قبول الدعوة", exact: true }), joinEndpoint);
  await expect(anonymousPage.getByTestId("shillatak-group")).toBeVisible();
  await expect(anonymousPage).toHaveURL(new URL(`/shillatak/${id}`, origin).href);
  check("registered-member-explicitly-accepted-and-entered-private-group");
  await expect(anonymousPage.getByTestId("shilla-owner-tools")).toHaveCount(0);
  await expect(anonymousPage.getByRole("button", { name: "مغادرة الشلّة", exact: true })).toBeVisible();
  await checkMobile(anonymousPage, "member-private-group-leaderboard");
  check("member-sees-own-role-and-no-owner-controls");
  await readPrivateProjection(anonymousPage, id, journey.nightId); check("member-api-projection-excludes-owner-and-night-secrets");
  const memberRead = await browserHttp(anonymousPage, endpoint);
  check("private-api-response-no-store-no-referrer-noindex", memberRead.headers["cache-control"].includes("no-store") &&
    memberRead.headers["referrer-policy"] === "no-referrer" && memberRead.headers["x-robots-tag"].includes("noindex"));
  for (const action of [{ op: "INVITE" }, { op: "ATTACH", nightId: journey.nightId }, { op: "ARCHIVE" },
    { op: "REVOKE", inviteId: randomUUID() }]) {
    check(`member-http-cannot-${action.op.toLowerCase()}`, (await browserHttp(anonymousPage, endpoint, { method: "POST", data: action })).status === 404);
  }
  check("owner-cannot-leave-without-approved-transfer-policy", (await browserHttp(owner, endpoint, { method: "POST", data: { op: "LEAVE" } })).status === 409);
  check("consumed-invite-cannot-be-reused-by-another-account", (await browserHttp(outsider, joinEndpoint, { method: "POST" })).status === 409);
  check("closed-invite-preview-hides-group-from-nonmember", (await browserHttp(outsider, joinEndpoint)).status === 404);
  await anonymousPage.reload(); await expect(anonymousPage.getByTestId("shillatak-group")).toBeVisible();
  check("member-reload-restores-same-private-membership");
  step = "member-inline-login-to-existing-membership"; checkpoint();
  // LogoutButton navigates after receiving headers without reading its JSON body.
  // Its body may be cancelled by that navigation; status + signed-out UI are the contract.
  // Simplified mobile navigation puts the real logout action inside the collapsed phone menu.
  const mobileMenu = anonymousPage.locator(".mobile-menu");
  await mobileMenu.locator("summary").click();
  await expect(mobileMenu).toHaveAttribute("open", "");
  await clickMutation(anonymousPage, mobileMenu.getByRole("button", { name: "خروج", exact: true }), "/api/auth/logout", 200, { readJson: false });
  step = "member-logout-navigation"; checkpoint();
  await anonymousPage.waitForURL(origin.href);
  step = "member-consumed-invite-inline-login-form"; checkpoint();
  await anonymousPage.goto(new URL(invitationPath, origin).href);
  await expect(anonymousPage.getByTestId("shillatak-join-auth")).toBeVisible();
  await anonymousPage.locator("#email").fill(memberCredentials.email); await anonymousPage.locator("#password").fill(memberCredentials.password);
  step = "member-consumed-invite-inline-login-submit"; checkpoint();
  await clickMutation(anonymousPage, anonymousPage.getByRole("button", { name: "تسجيل الدخول", exact: true }), "/api/auth/login");
  step = "member-consumed-invite-inline-login-result"; checkpoint();
  await expect(anonymousPage.getByRole("link", { name: "دخول الشلّة", exact: true })).toBeVisible();
  await expect(anonymousPage).toHaveURL(new URL(invitationPath, origin).href);
  check("inline-existing-account-login-returns-to-the-same-protected-invitation");
  await anonymousPage.getByRole("link", { name: "دخول الشلّة", exact: true }).click();
  await expect(anonymousPage.getByTestId("shillatak-group")).toBeVisible();
  check("existing-membership-reentry-does-not-consume-another-invite-or-duplicate-membership",
    (await sql('SELECT count(*)::int AS n FROM "ShillaMembership" WHERE "shillaId"=$1', [id]))[0].n === 2);
  step = "owner-attach-actual-completed-engine-night"; checkpoint();
  await owner.reload(); await expect(owner.locator("#shilla-new-link")).toHaveCount(0);
  const beforeAttach = await groupView(owner, id);
  const eligibleIndex = beforeAttach.eligibleNights.findIndex(candidate => candidate.id === journey.nightId);
  assert.ok(eligibleIndex >= 0, "The actually played Night must be eligible");
  const attached = await clickMutation(owner, owner.getByRole("button", { name: "سجّل النتيجة", exact: true }).nth(eligibleIndex), endpoint);
  assert.equal(attached.shilla.nights.length, 1);
  assert.deepEqual(attached.shilla.leaderboard.map(team => team.points), [...totals].sort((a, b) => b - a));
  const expectedWins = night.state.teams.map(team => night.state.totals[team.id] === Math.max(...totals));
  for (const [index, team] of attached.shilla.teams.entries()) {
    const standing = attached.shilla.leaderboard.find(item => item.id === team.id);
    assert.equal(standing.points, totals[index]); assert.equal(standing.wins, Number(expectedWins[index])); assert.equal(standing.played, 1);
  }
  check("ui-attached-real-three-engine-night-with-authoritative-points-and-championship");
  await owner.reload(); await expect(owner.getByTestId("shillatak-group")).toContainText("Asia/Riyadh");
  check("attached-history-owner-reload-preserves-time-zone-and-points", (await groupView(owner, id)).nights.length === 1);
  const repeated = await browserHttp(owner, endpoint, { method: "POST", data: { op: "ATTACH", nightId: journey.nightId } });
  assert.equal(repeated.status, 200); assert.equal(repeated.body.shilla.nights.length, 1);
  assert.equal((await sql('SELECT count(*)::int AS n FROM "ShillaNight" WHERE "nightId"=$1', [journey.nightId]))[0].n, 1);
  check("repeated-attach-preserves-exactly-one-night-and-award");
  check("attach-rejects-browser-supplied-points", (await browserHttp(owner, endpoint,
    { method: "POST", data: { op: "ATTACH", nightId: journey.nightId, points: 999 } })).status === 400);
  await anonymousPage.getByRole("button", { name: "تحديث الشلّة", exact: true }).click();
  await expect(anonymousPage.getByTestId("shilla-leaderboard")).toContainText(String(Math.max(...totals)));
  const memberView = await readPrivateProjection(anonymousPage, id, journey.nightId);
  assert.equal(memberView.nights.length, 1); assert.deepEqual(memberView.leaderboard, attached.shilla.leaderboard);
  check("member-refresh-sees-same-persisted-team-points-and-private-history");
  await anonymousPage.getByTestId("shillatak-group").screenshot({ path: join(evidence, "member-leaderboard.png") });
  await owner.getByTestId("shillatak-group").screenshot({ path: join(evidence, "owner-leaderboard.png") });
  step = "fresh-invite-revocation-clears-one-time-link"; checkpoint();
  invite = await clickMutation(owner, owner.getByRole("button", { name: "إنشاء رابط عضوية", exact: true }), endpoint, 201);
  const revokedPath = invite.invitation.path;
  await expect(owner.getByRole("button", { name: "إلغاء الدعوة", exact: true })).toHaveCount(1);
  await clickMutation(owner, owner.getByRole("button", { name: "إلغاء الدعوة", exact: true }), endpoint);
  await expect(owner.locator("#shilla-new-link")).toHaveCount(0);
  await expect(owner.getByRole("button", { name: "إلغاء الدعوة", exact: true })).toHaveCount(0);
  const revokedEndpoint = revokedPath.replace("/shillatak/join/", "/api/shillatak/join/");
  check("fresh-invite-revokes-immediately-and-removes-displayed-raw-url");
  check("revoked-link-cannot-be-accepted-or-disclose-group-to-outsider", (await browserHttp(outsider, revokedEndpoint, { method: "POST" })).status === 409 &&
    (await browserHttp(outsider, revokedEndpoint)).status === 404);
  step = "member-leave-and-commit-then-lost-response-recovery"; checkpoint();
  await clickMutation(anonymousPage, anonymousPage.getByRole("button", { name: "مغادرة الشلّة", exact: true }), endpoint);
  await expect(anonymousPage.getByTestId("shillatak-home")).toBeVisible();
  check("member-explicit-leave-removes-private-api-access", (await browserHttp(anonymousPage, endpoint)).status === 404);
  invite = await clickMutation(owner, owner.getByRole("button", { name: "إنشاء رابط عضوية", exact: true }), endpoint, 201);
  const lostPath = invite.invitation.path, lostEndpoint = lostPath.replace("/shillatak/join/", "/api/shillatak/join/");
  privateSave("fault-invitation.private.json", { path: lostPath });
  await anonymousPage.goto(new URL(lostPath, origin).href); await expect(anonymousPage.getByTestId("shillatak-join")).toBeVisible();
  let actualCommittedStatus = null, faultInjected = false;
  result.faultProbe = { originalResponseStatus: null, transportAborted: false };
  transportFaultActive = true;
  await anonymousPage.route(new URL(lostEndpoint, origin).href, async route => {
    if (route.request().method() !== "POST" || faultInjected) return route.continue();
    faultInjected = true;
    try { const response = await route.fetch({ headers: await route.request().allHeaders(), timeout: 15_000 }); actualCommittedStatus = response.status(); }
    catch { actualCommittedStatus = -1; }
    result.faultProbe.originalResponseStatus = actualCommittedStatus;
    await route.abort("connectionreset");
    result.faultProbe.transportAborted = true;
    checkpoint();
  });
  await anonymousPage.getByRole("button", { name: "قبول الدعوة", exact: true }).click();
  step = "fault-probe-await-real-commit-and-abort"; checkpoint();
  await expect.poll(() => actualCommittedStatus, { timeout: 15_000 }).toBe(200);
  await expect.poll(() => result.faultProbe.transportAborted, { timeout: 15_000 }).toBe(true);
  // Next's shadow-DOM route announcer also has role=alert; assert the actual
  // invitation error rather than matching that unrelated framework live region.
  const networkAlert = anonymousPage.getByTestId("shillatak-join").getByRole("alert");
  await expect(networkAlert).toBeVisible({ timeout: 15_000 });
  await expect(networkAlert).toContainText("تعذر الاتصال");
  assert.equal(actualCommittedStatus, 200); assert.equal(faultInjected, true);
  step = "fault-probe-remove-interception"; checkpoint();
  await anonymousPage.unroute(new URL(lostEndpoint, origin).href);
  transportFaultActive = false;
  step = "fault-probe-repeat-consumed-token"; checkpoint();
  const repeatAccept = await browserHttp(anonymousPage, lostEndpoint, { method: "POST" });
  check("lost-response-probe-committed-once-and-still-rejects-consumed-token-retry", repeatAccept.status === 409);
  step = "fault-probe-reload-authorized-membership"; checkpoint();
  await anonymousPage.reload(); await expect(anonymousPage.getByRole("link", { name: "دخول الشلّة", exact: true })).toBeVisible();
  await anonymousPage.getByRole("link", { name: "دخول الشلّة", exact: true }).click();
  await expect(anonymousPage.getByTestId("shillatak-group")).toBeVisible();
  assert.equal((await sql('SELECT count(*)::int AS n FROM "ShillaMembership" WHERE "shillaId"=$1', [id]))[0].n, 2);
  check("lost-acceptance-response-reload-recovers-authorized-membership-without-reusing-invite");
  await clickMutation(anonymousPage, anonymousPage.getByRole("button", { name: "مغادرة الشلّة", exact: true }), endpoint);
  await expect(anonymousPage.getByTestId("shillatak-home")).toBeVisible();
  check("second-explicit-leave-preserves-history-and-revokes-member-access", (await browserHttp(anonymousPage, endpoint)).status === 404);
  step = "archive-group-with-an-outstanding-invitation"; checkpoint();
  invite = await clickMutation(owner, owner.getByRole("button", { name: "إنشاء رابط عضوية", exact: true }), endpoint, 201);
  const archivedInvitePath = invite.invitation.path;
  await expect(owner.locator("#shilla-new-link")).toHaveCount(1);
  await owner.getByRole("button", { name: "أرشفة الشلّة", exact: true }).click();
  const archived = await clickMutation(owner, owner.getByRole("button", { name: "تأكيد الأرشفة", exact: true }), endpoint);
  assert.equal(archived.shilla.status, "archived"); assert.equal(archived.shilla.nights.length, 1);
  await expect(owner.getByTestId("shilla-owner-tools")).toHaveCount(0); await expect(owner.locator("#shilla-new-link")).toHaveCount(0);
  check("explicit-archive-clears-raw-invite-and-preserves-read-only-team-history");
  const archivedEndpoint = archivedInvitePath.replace("/shillatak/join/", "/api/shillatak/join/");
  check("archived-group-rejects-pending-invite-and-new-night-attachments", (await browserHttp(outsider, archivedEndpoint, { method: "POST" })).status === 409 &&
    (await browserHttp(owner, endpoint, { method: "POST", data: { op: "ATTACH", nightId: journey.nightId } })).status === 409);
  await owner.setViewportSize({ width: 390, height: 844 }); await checkMobile(owner, "archived-owner-private-group");
  await owner.getByTestId("shillatak-group").screenshot({ path: join(evidence, "archived-private-group.png") });
  await owner.reload(); const restored = await groupView(owner, id);
  assert.equal(restored.status, "archived"); assert.equal(restored.nights.length, 1); assert.equal(restored.members.length, 1);
  check("reload-restores-archived-state-immutable-history-and-left-membership");
  check("all-shillatak-actions-preserve-owner-wallet-and-credit-ledger", await wallet() === before &&
    (await sql('SELECT count(*)::int AS n FROM "GameCredit" WHERE "userId"=$1', [fixture.ownerId]))[0].n === ledgerBefore);
  for (const slot of night.state.results) {
    const debit = await sql('SELECT count(*)::int AS n FROM "GameCredit" WHERE "userId"=$1 AND "idempotencyKey"=$2 AND "delta"=-1',
      [fixture.ownerId, `game-start:${slot.sourceSessionId}`]);
    assert.equal(debit[0].n, 1);
  }
  check("only-existing-three-canonical-start-debits-for-the-played-night");
  privateSave("cases.private.json", { groupId: id, ownerId: fixture.ownerId, nightId: journey.nightId,
    invitationPath, revokedPath, lostPath, archivedInvitePath, memberEmail: memberCredentials.email });
  privateSave("journey.private.json", { groupId: id, ownerId: fixture.ownerId, nightId: journey.nightId,
    invitePath: archivedInvitePath });
  privateSave("owner-cookies.private.json", await ownerContext.cookies());
  privateSave("member-cookies.private.json", await anonymous.cookies());
  check("no-browser-page-exceptions", result.observations.pageExceptions === 0);
  check("no-hydration-or-unclassified-console-errors", !result.observations.consoleErrorCategories.hydration &&
    !result.observations.consoleErrorCategories["other-redacted"]);
  check("no-external-browser-service-requests", result.observations.externalBrowserRequests === 0);
  result.status = "PASSED";
} catch (error) {
  result.status = "FAILED"; result.failureStep = step;
  result.failureType = error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name) ? error.name : "UnknownError";
  privateSave("failure.private.json", { name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unspecified failure" });
  result.failureUi = await activePage?.evaluate(() => ({
    group: Boolean(document.querySelector('[data-testid="shillatak-group"]')),
    join: Boolean(document.querySelector('[data-testid="shillatak-join"]')),
    home: Boolean(document.querySelector('[data-testid="shillatak-home"]')),
    alerts: document.querySelectorAll('[role="alert"]').length,
    networkAlert: [...document.querySelectorAll('[role="alert"]')].some(node => /تعذر الاتصال/.test(node.textContent ?? "")),
  })).catch(() => null);
  // Browser errors can contain bearer URLs, credentials or DOM content. Never emit them.
} finally {
  let browserClosed = false, databasePoolEnded = false;
  try { await browser?.close(); browserClosed = !browser?.isConnected(); }
  catch { result.status = "FAILED"; result.failureStep ??= "browser-cleanup"; }
  try { await pool.end(); databasePoolEnded = true; }
  catch { result.status = "FAILED"; result.failureStep ??= "database-cleanup"; }
  result.cleanup = { browserClosed, databasePoolEnded };
  result.finishedAt = new Date().toISOString(); result.passed = result.checks.length; result.failed = result.status === "FAILED" ? 1 : 0;
  writeFileSync(join(evidence, "receipt.json"), JSON.stringify(result, null, 2), { mode: 0o600, flag: "wx" });
}
console.log(JSON.stringify({ status: result.status, passed: result.passed, failed: result.failed,
  failureStep: result.failureStep ?? null, browser: chromeVersion }));
process.exitCode = result.status === "PASSED" ? 0 : 1;
