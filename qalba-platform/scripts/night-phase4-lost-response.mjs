/** Real HTTP fault injection: fetch commits the real POST, then drop its reply.
 * No fabricated backend response. Run before/after UI correction with a new run name.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium, expect } from "@playwright/test";
import { Pool } from "pg";

assert.equal(process.env.NIGHT_MVP_SYNTHETIC, "1");
const envPath = realpathSync(process.env.NIGHT_MVP_ENV_FILE ?? "");
assert.equal(statSync(envPath).mode & 0o077, 0); assert.ok(relative(process.cwd(), envPath).startsWith(".."));
const config = JSON.parse(readFileSync(envPath, "utf8"));
const database = new URL(config.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(database.hostname));
assert.match(database.pathname, /^\/night_mvp(?:_[a-z0-9_]+)?$/); assert.equal(database.searchParams.has("host"), false);
const origin = new URL(process.env.BASE_URL ?? "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:"); assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname));
const output = realpathSync(process.env.NIGHT_MVP_OUTPUT ?? ""); assert.ok(relative(process.cwd(), output).startsWith(".."));
const fixture = JSON.parse(readFileSync(join(output, "fixture.private.json"), "utf8"));
const evidence = join(output, process.env.NIGHT_PHASE4_RUN ?? "phase4-lost-response"); mkdirSync(evidence, { mode: 0o700 });
const pool = new Pool({ connectionString: config.DATABASE_URL, max: 1 });
const marker = await pool.query('SELECT "config" FROM "FeatureFlag" WHERE "key"=$1', ["night-mvp-synthetic-fixture"]);
assert.equal(marker.rows[0].config.run, fixture.run);
const receipt = { sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  browser: execFileSync(process.env.CHROME_EXECUTABLE, ["--version"], { encoding: "utf8" }).trim(), syntheticOnly: true,
  realPostCommitted: false, fault: "drop-first-real-POST-response-after-server-commit", status: "FAILED" };
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, headless: true,
    ...(process.env.NIGHT_MVP_CHROME_NO_SANDBOX === "1" ? { args: ["--no-sandbox"] } : {}) });
  const owner = await browser.newContext();
  await owner.addCookies([{ name: "qalba_session", value: fixture.ownerToken, url: origin.origin, httpOnly: true, sameSite: "Lax" }]);
  const created = await owner.request.post(new URL("/api/night", origin).href, { headers: { Origin: origin.origin },
    data: { key: crypto.randomUUID(), games: ["top-list", "ordering-challenge", "survey-show"], teams: ["فريق إعادة أول", "فريق إعادة ثان"] } });
  assert.equal(created.status(), 201); const night = (await created.json()).night;
  const invitation = await owner.request.post(new URL(`/api/night/${night.id}/invitation`, origin).href, { headers: { Origin: origin.origin },
    data: { scheduledAt: new Date(Date.now() + 3600_000).toISOString(), timezone: "Asia/Riyadh" } });
  assert.equal(invitation.status(), 201); const path = (await invitation.json()).invitation.path;
  const guest = await browser.newContext(); const page = await guest.newPage();
  let bootstrapGetRequests = 0;
  page.on("request", request => {
    if (request.method() === "GET" && new URL(request.url()).pathname.startsWith("/api/night/invite/")) bootstrapGetRequests++;
  });
  await page.goto(new URL(path, origin).href);
  const name = page.getByLabel("اسمك في الدعوة (بدون بيانات شخصية)", { exact: true });
  await expect(name).toBeEditable(); await name.fill("زائر إعادة اصطناعي");
  receipt.bootstrapGetRequests = bootstrapGetRequests;
  await expect.poll(async () => (await guest.cookies()).filter(x => x.name.startsWith("quddam_night_rsvp_")).length).toBe(1);
  receipt.preissuedHttpOnlyCookie = (await guest.cookies()).some(x => x.name.startsWith("quddam_night_rsvp_") && x.httpOnly);
  let intercepted = false;
  await page.route(url => url.pathname.startsWith("/api/night/invite/"), async route => {
    if (route.request().method() !== "POST" || intercepted) return route.continue();
    intercepted = true;
    const response = await route.fetch(); assert.equal(response.status(), 200); receipt.realPostCommitted = true;
    await route.abort("connectionreset");
  });
  await page.getByRole("button", { name: "تأكيد ردي", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  receipt.nameEditableAfterLostReply = await name.isEditable();
  if (receipt.nameEditableAfterLostReply) {
    await name.fill("زائر باسم مختلف");
    const response = page.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname.startsWith("/api/night/invite/"));
    await page.getByRole("button", { name: "تأكيد ردي", exact: true }).click();
    receipt.changedAliasRetryStatus = (await response).status();
    receipt.status = receipt.changedAliasRetryStatus === 409 ? "REPRODUCED" : "FAILED";
  } else {
    const retry = page.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname.startsWith("/api/night/invite/"));
    const retryButton = page.getByRole("button", { name: /تأكيد ردي|تحديث ردي وتصويتي|إعادة/ });
    await retryButton.click(); receipt.retryStatus = (await retry).status();
    await page.reload(); await expect(page.getByRole("status").filter({ hasText: "ردّك المحفوظ" })).toBeVisible();
    // Use the real Chrome cookie jar (Secure loopback cookies are omitted by
    // Playwright's separate Node HTTP client on http://127.0.0.1).
    const view = await page.evaluate(async api => {
      const response = await fetch(api, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Saved response read failed");
      return (await response.json()).invitation;
    }, path.replace("/night/invite/", "/api/night/invite/"));
    assert.equal(view.coming, 1); assert.equal(view.mine.name, "زائر إعادة اصطناعي");
    receipt.sameAttendeeCountAfterRetry = view.coming; receipt.status = receipt.retryStatus === 200 ? "PASSED" : "FAILED";
  }
} catch { receipt.status = "FAILED"; }
finally {
  await browser?.close(); await pool.end(); receipt.finishedAt = new Date().toISOString();
  writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2), { mode: 0o600, flag: "wx" });
}
console.log(JSON.stringify(receipt));
process.exitCode = receipt.status === "FAILED" ? 1 : 0;
