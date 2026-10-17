/**
 * Real independent Chromium contexts + actual Next HTTP + isolated native PG17.
 * The organizer revokes the link through the real confirmation button.
 * Before/after guests are independent browser storage contexts, never mocks.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { Pool } from "pg";
import { chromium, expect } from "@playwright/test";

assert.equal(process.env.NIGHT_MVP_SYNTHETIC, "1");
assert.notEqual(process.env.NODE_ENV, "production");
const file = realpathSync(process.env.NIGHT_MVP_ENV_FILE ?? "");
assert.equal(statSync(file).mode & 0o077, 0);
assert.ok(relative(process.cwd(), file).startsWith(".."));
const cfg = JSON.parse(readFileSync(file, "utf8"));
assert.equal(process.env.DATABASE_URL, cfg.DATABASE_URL);
const url = new URL(cfg.DATABASE_URL);
assert.equal(url.protocol, "postgresql:");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
assert.match(url.pathname, /^\/night_mvp(?:_[a-z0-9_]+)?$/);
assert.equal(url.searchParams.has("host"), false);
const output = process.env.NIGHT_MVP_OUTPUT;
assert.ok(output && isAbsolute(output) && relative(process.cwd(), realpathSync(output)).startsWith(".."));
const fixturePath = join(output, "fixture.private.json");
assert.ok(existsSync(fixturePath));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const origin = new URL(process.env.BASE_URL ?? "");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
assert.equal(origin.pathname, "/");
assert.equal(origin.port, "3100");
const evidence = join(output, "revoke-browser");
mkdirSync(evidence, { mode: 0o700 });
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const pool = new Pool({ connectionString: cfg.DATABASE_URL, max: 2 });
const checks = [];
let browser, step = "initialize", pass = false;
function check(name, condition) { assert.ok(condition, name); checks.push({ name, passed: true }); }
function apiPath(path) { return new URL(path, origin).href; }
async function inBrowser(page, path) {
  return page.evaluate(async p => {
    const response = await fetch(p, { cache: "no-store", credentials: "same-origin" });
    return { status: response.status, value: await response.json() };
  }, path);
}
try {
  const marker = await pool.query('SELECT "config" FROM "FeatureFlag" WHERE "key"=$1', ["night-mvp-synthetic-fixture"]);
  assert.equal(marker.rows[0].config.run, fixture.run);
  const identity = await pool.query("SELECT current_database() AS database, current_setting('server_version_num')::int AS version");
  assert.equal(identity.rows[0].database, url.pathname.slice(1));
  assert.ok(identity.rows[0].version >= 170000 && identity.rows[0].version < 180000);
  const balance = (await pool.query('SELECT balance FROM "CreditWallet" WHERE "userId"=$1', [fixture.ownerId])).rows[0].balance;
  const beforeDebits = (await pool.query('SELECT count(*)::int AS n FROM "GameCredit" WHERE "userId"=$1 AND delta=-1', [fixture.ownerId])).rows[0].n;
  browser = await chromium.launch({ headless: true });
  const owner = await browser.newContext({ viewport: { width: 1440, height: 960 }, timezoneId: "Asia/Riyadh" });
  await owner.addCookies([{ name: "qalba_session", value: fixture.ownerToken, url: origin.href, httpOnly: true, secure: false, sameSite: "Lax" }]);
  const host = await owner.newPage();
  step = "owner-create-night";
  await host.goto(apiPath("/night/new"));
  await expect(host.getByTestId("night-setup")).toBeVisible();
  await host.getByTestId("night-team-a").fill("فريق متصفح أول");
  await host.getByTestId("night-team-b").fill("فريق متصفح ثان");
  const createdPromise = host.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/night");
  await host.getByTestId("night-create").click();
  const created = await createdPromise;
  assert.equal(created.status(), 201);
  const nightId = (await created.json()).night.id;
  await expect(host.getByTestId("night-dashboard")).toHaveAttribute("data-phase", "preparing");
  check("actual-organizer-session-creates-a-new-synthetic-night", true);

  step = "owner-create-real-invitation";
  const panel = host.getByTestId("night-invitation-setup");
  await expect(panel).toBeVisible();
  const futureLocal = await host.evaluate(() => {
    const d = new Date(Date.now() + 3600_000), p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  await host.locator("#night-invite-time").fill(futureLocal);
  const invitationPromise = host.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/night/${nightId}/invitation`);
  await host.getByRole("button", { name: "أنشئ رابط الدعوة", exact: true }).click();
  const invitationResponse = await invitationPromise;
  assert.equal(invitationResponse.status(), 201);
  const invitePath = (await invitationResponse.json()).invitation.path;
  assert.match(invitePath, /^\/night\/invite\/[a-f0-9]{64}$/);
  const guestApi = invitePath.replace("/night/invite/", "/api/night/invite/");
  await expect(host.locator("#night-invite-link")).toHaveValue(apiPath(invitePath));
  check("real-organizer-created-once-and-has-one-time-bearer", true);

  step = "independent-existing-guest-pre-revocation";
  const first = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Riyadh" });
  const firstPage = await first.newPage();
  const firstLoad = await firstPage.goto(apiPath(invitePath));
  assert.equal(firstLoad.status(), 200);
  await expect(firstPage.getByTestId("night-public-invitation")).toBeVisible();
  await firstPage.getByLabel("اسمك في الدعوة (بدون بيانات شخصية)").fill("ضيف موجود قبل الإلغاء");
  await firstPage.getByRole("radio", { name: "توب 100", exact: true }).check();
  const responsePromise = firstPage.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === guestApi);
  await firstPage.getByTestId("night-rsvp-submit").click();
  const accepted = await responsePromise;
  assert.equal(accepted.status(), 200);
  check("separate-guest-can-accept-before-revocation", (await accepted.json()).invitation.coming === 1);
  const guestCookieCount = (await first.cookies()).filter(c => c.name.startsWith("quddam_night_rsvp_")).length;
  check("guest-has-own-private-capability-cookie", guestCookieCount === 1);
  // Another stranger has a fresh cookie jar and no previously accepted identity.
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Riyadh" });
  check("existing-and-new-guest-cookies-are-isolated", (await fresh.cookies()).length === 0);

  step = "actual-owner-button-revocation";
  host.once("dialog", dialog => dialog.accept());
  const deletePromise = host.waitForResponse(r => r.request().method() === "DELETE" && new URL(r.url()).pathname === `/api/night/${nightId}/invitation`);
  await host.getByRole("button", { name: "إلغاء رابط الدعوة نهائيًا", exact: true }).click();
  const deleted = await deletePromise;
  assert.equal(deleted.status(), 200);
  assert.deepEqual(await deleted.json(), { revoked: true });
  await expect(panel.getByText(/الدعوة ملغاة؛ الرابط القديم غير صالح/)).toBeVisible();
  await expect(host.locator("#night-invite-link")).toHaveCount(0);
  await expect(host.getByRole("button", { name: "إلغاء رابط الدعوة نهائيًا" })).toHaveCount(0);
  check("owner-confirmation-invalidates-link-and-clears-raw-URL-in-UI", true);

  step = "fresh-second-context-after-revocation";
  const freshPage = await fresh.newPage();
  const freshDoc = await freshPage.goto(apiPath(invitePath));
  assert.equal(freshDoc.status(), 200); // shell is intentionally public, API must deny.
  await expect(freshPage.getByRole("alert")).toContainText("تعذر فتح الدعوة أو انتهت صلاحيتها");
  await expect(freshPage.getByTestId("night-rsvp-submit")).toHaveCount(0);
  const freshRead = await fresh.request.get(apiPath(guestApi));
  check("new-independent-browser-receives-404-not-invitation", freshRead.status() === 404);
  check("revoked-GET-never-issues-a-new-capability-cookie", freshRead.headers()["set-cookie"] === undefined);
  const freshPost = await fresh.request.post(apiPath(guestApi), {
    headers: { Origin: origin.origin },
    data: { name: "ضيف بعد الإلغاء", rsvp: "YES", gameVote: "top-list" },
  });
  check("new-independent-browser-cannot-RSVP-after-revocation", freshPost.status() === 404);
  check("new-independent-context-has-no-owner-cookie", !(await fresh.cookies()).some(c => c.name === "qalba_session"));
  const unauthorizedDelete = await fresh.request.delete(apiPath(`/api/night/${nightId}/invitation`), { headers: { Origin: origin.origin } });
  check("stranger-cannot-revoke-other-owners-night", unauthorizedDelete.status() === 401);

  step = "previously-accepted-guest-also-blocked";
  await firstPage.reload();
  await expect(firstPage.getByRole("alert")).toContainText("تعذر فتح الدعوة أو انتهت صلاحيتها");
  await expect(firstPage.getByTestId("night-rsvp-submit")).toHaveCount(0);
  const oldPost = await first.request.post(apiPath(guestApi), {
    headers: { Origin: origin.origin },
    data: { name: "ضيف موجود قبل الإلغاء", rsvp: "YES", gameVote: "top-list" },
  });
  check("existing-cookie-replay-cannot-bypass-revocation", oldPost.status() === 404);
  const summary = await inBrowser(host, `/api/night/${nightId}/invitation`);
  assert.equal(summary.status, 200);
  assert.equal(summary.value.invitation.status, "closed");
  assert.equal(summary.value.invitation.coming, 1);
  assert.equal(summary.value.invitation.votes.find(g => g.game === "top-list").count, 1);
  assert.equal(summary.value.invitation.linkRecoverable, false);
  check("organizer-aggregate-retains-prior-attendee-and-vote-without-secret", !JSON.stringify(summary.value).includes(invitePath.split("/").at(-1)));
  const stored = await pool.query('SELECT i.status, count(g.id)::int AS attendees FROM "NightInvitation" i LEFT JOIN "NightInviteGuest" g ON g."inviteId"=i.id WHERE i."nightId"=$1 GROUP BY i.status', [nightId]);
  assert.deepEqual(stored.rows.map(x => ({ status: x.status, attendees: x.attendees })), [{ status: "closed", attendees: 1 }]);
  assert.equal((await pool.query('SELECT balance FROM "CreditWallet" WHERE "userId"=$1', [fixture.ownerId])).rows[0].balance, balance);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM "GameCredit" WHERE "userId"=$1 AND delta=-1', [fixture.ownerId])).rows[0].n, beforeDebits);
  check("native-DB-persists-single-prior-attendee-zero-credit-debits-and-revoked-state", true);
  await owner.close(); await first.close(); await fresh.close();
  pass = true;
} finally {
  await browser?.close();
  await pool.end();
  const receipt = { sourceHead: head, status: pass ? "PASSED" : "FAILED", failureStep: pass ? null : step,
    syntheticOnly: true, nativePostgres17: true, actualChromiumContexts: 3, actualHttp: true,
    requestMocks: false, checks, privateCredentialsInviteCodesAndAnswersWithheld: true };
  writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2), { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ status: receipt.status, passed: checks.length, failed: pass ? 0 : 1, failureStep: receipt.failureStep }));
}
