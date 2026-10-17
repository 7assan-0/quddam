/** Real Chrome and loopback HTTP acceptance of the existing site/legacy Room.
 * Does not exercise PR #9 WebRTC. No mocked HTTP, game results, or billing rules.
 * All SQL writes are delegated to the guarded append-only synthetic fixture tool.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { chromium, expect } from "@playwright/test";
import { Pool } from "pg";

assert.equal(process.env.NIGHT_MVP_SYNTHETIC, "1");
assert.notEqual(process.env.NODE_ENV, "production");
const environment = realpathSync(process.env.NIGHT_MVP_ENV_FILE ?? "");
assert.equal(statSync(environment).mode & 0o077, 0);
assert.ok(relative(process.cwd(), environment).startsWith(".."));
const config = JSON.parse(readFileSync(environment, "utf8")), dbUrl = new URL(config.DATABASE_URL);
assert.equal(dbUrl.protocol, "postgresql:");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(dbUrl.hostname));
assert.match(dbUrl.pathname, /^\/night_mvp(?:_[a-z0-9_]+)?$/);
assert.ok(!dbUrl.searchParams.has("host"));
const root = realpathSync(process.env.NIGHT_MVP_OUTPUT ?? "");
assert.ok(relative(process.cwd(), root).startsWith(".."));
const output = join(root, process.env.BETA_SITE_RUN ?? "beta-site-chrome");
mkdirSync(output, { mode: 0o700 });
const origin = new URL(process.env.BASE_URL ?? "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname));
assert.equal(origin.pathname, "/");
const executablePath = process.env.CHROME_EXECUTABLE;
assert.ok(executablePath && isAbsolute(executablePath));
const browserVersion = execFileSync(executablePath, ["--version"], { encoding: "utf8" }).trim();
assert.match(browserVersion, /^Google Chrome/);
const fixture = JSON.parse(readFileSync(join(root, "fixture.private.json"), "utf8"));
const pool = new Pool({ connectionString: config.DATABASE_URL, max: 2 });
const identity = await pool.query("SELECT current_database() AS database, version() AS version");
assert.equal(identity.rows[0].database, dbUrl.pathname.slice(1));
assert.match(identity.rows[0].version, /^PostgreSQL 17\./);
const marker = (await pool.query('SELECT config FROM "FeatureFlag" WHERE key=$1', ["night-mvp-synthetic-fixture"])).rows[0];
assert.equal(marker.config.run, fixture.run);
const result = { schemaVersion: 1,
  sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceDirty: !!execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim(),
  browser: browserVersion, headless: true, realHttp: true, syntheticOnly: true, nativePostgres17: true,
  mocks: false, siteScope: "36-cell category-board/Room; PR9 WebRTC not included",
  checks: [], pageAudit: [], screenshots: [], errors: { pageExceptions: 0, consoleErrors: 0, consoleErrorCategories: {}, failedRequests: 0, failedRequestCategories: {}, externalRequests: 0 },
  startedAt: new Date().toISOString(), limitations: ["Single-machine loopback only; LAN/NAT NOT RUN", "Other game setup pages smoke-tested; only category-board played by this harness"],
};
let browser, page, step = "launch", ownerId;
const check = (name, condition = true) => { assert.ok(condition, name); result.checks.push({ name, passed: true }); };
const checkpoint = name => { step = name; writeFileSync(join(output, "progress.json"), JSON.stringify({ ...result, step }), { mode: 0o600 }); };
function observe(p) {
  p.on("pageerror", () => result.errors.pageExceptions++);
  p.on("console", m => {
    if (m.type() !== "error") return;
    result.errors.consoleErrors++;
    const status = m.text().match(/Failed to load resource:.*status of (\d{3})/i)?.[1];
    const category = status ? `http-${status}` : /hydration/i.test(m.text()) ? "hydration" : "other-redacted";
    result.errors.consoleErrorCategories[category] = (result.errors.consoleErrorCategories[category] ?? 0) + 1;
  });
  p.on("requestfailed", r => {
    result.errors.failedRequests++;
    const error = r.failure()?.errorText ?? "UNKNOWN";
    const code = /^net::ERR_[A-Z_]+$/.test(error) ? error : "OTHER_REDACTED";
    const path = new URL(r.url()).pathname;
    const category = `${path.endsWith("/events") ? "event-stream" : r.headers().rsc === "1" ? "next-rsc-prefetch" : path.startsWith("/_next/") ? "next-internal" : path.startsWith("/api/") ? "api" : "page-or-asset"}:${r.resourceType()}:${code}`;
    result.errors.failedRequestCategories[category] = (result.errors.failedRequestCategories[category] ?? 0) + 1;
  });
  p.on("request", r => { const u = new URL(r.url()); if (["http:", "https:"].includes(u.protocol) && u.origin !== origin.origin) result.errors.externalRequests++; });
}
async function audit(p, label, screenshot = false) {
  // Next streams its loading boundary before the page body. An HTTP 200 and a
  // non-overflowing skeleton are not evidence that the requested UI rendered.
  await expect(p.locator("#main-content h1").first()).toBeVisible();
  await p.locator("html").evaluate(e => document.fonts.ready.then(() => e.dir));
  const shape = await p.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir,
    width: innerWidth, scrollWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth), h1: document.querySelectorAll("h1").length }));
  check(`${label}: Arabic RTL and no horizontal overflow`, shape.lang === "ar" && shape.dir === "rtl" && shape.scrollWidth <= shape.width);
  result.pageAudit.push({ page: label, ...shape });
  if (screenshot) {
    // Capture from the top, after command auto-scrolling, so sticky/fixed chrome
    // is not pasted halfway down a full-page evidence image by the browser.
    await p.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const file = `${label}.png`; await p.screenshot({ path: join(output, file), fullPage: true }); result.screenshots.push(file);
  }
}
async function http(p, path, method = "GET", body) {
  return p.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, { method, cache: "no-store", credentials: "same-origin",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const type = response.headers.get("content-type") ?? "";
    return { status: response.status, body: type.includes("application/json") ? await response.json() : null };
  }, { path, method, body });
}
async function mutation(p, button, suffix, status = 200) {
  const response = p.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith(suffix));
  await button.click(); const actual = await response;
  assert.equal(actual.status(), status, `HTTP status at ${step}`);
  return actual.json();
}
async function wallet() { return (await pool.query('SELECT balance FROM "CreditWallet" WHERE "userId"=$1', [ownerId])).rows[0].balance; }

try {
  browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  const owner = await browser.newContext({ baseURL: origin.origin, viewport: { width: 1440, height: 1000 }, locale: "ar-SA" });
  page = await owner.newPage(); observe(page);
  checkpoint("public-pages");
  for (const path of ["/", "/pricing", "/privacy", "/join", "/forgot-password", "/register", "/login"]) {
    const response = await page.goto(path);
    check(`Public route ${path} serves real HTTP`, response.status() === 200);
    await audit(page, `desktop-${path === "/" ? "home" : path.slice(1)}`, path === "/");
    await page.setViewportSize({ width: 390, height: 844 });
    await audit(page, `mobile-${path === "/" ? "home" : path.slice(1)}`, path === "/");
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto("/games"); await expect(page).toHaveURL(/\/login/);
  check("Anonymous game library redirects to login without protected content");
  checkpoint("real-register");
  const email = `beta-site-${randomUUID()}@example.test`, password = `Beta-${randomUUID()}!`;
  const accountPath = join(output, "account.private.json");
  writeFileSync(accountPath, JSON.stringify({ run: fixture.run, email, password }), { mode: 0o600, flag: "wx" });
  await page.goto("/register");
  await page.getByLabel("الاسم", { exact: true }).fill("مضيف قبول الموقع الاصطناعي");
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
  await mutation(page, page.getByRole("button", { name: "إنشاء الحساب", exact: true }), "/api/auth/register", 201);
  await expect(page).toHaveURL(/\/games$/);
  ownerId = (await pool.query('SELECT id FROM "User" WHERE email=$1', [email])).rows[0].id;
  check("Actual registration UI establishes signed-in browser session");
  check("Disabled welcome grant leaves new account at zero credits", await wallet() === 0);
  execFileSync(process.execPath, ["--import", "tsx", "scripts/beta-site-fixtures.ts"], {
    env: { ...process.env, BETA_SITE_ACCOUNT_FILE: accountPath }, stdio: "pipe", timeout: 30_000,
  });
  check("Only guarded canonical synthetic admin grant funds dedicated browser account", await wallet() === 3);
  await page.reload();
  await expect(page.locator(".game-card")).toHaveCount(10);
  check("All ten launch game cards shown and enabled");
  const paths = await page.locator(".game-card a").evaluateAll(links => links.map(a => a.getAttribute("href")));
  for (let i = 0; i < paths.length; i++) {
    checkpoint(`game-setup-${i + 1}`);
    const response = await page.goto(paths[i]);
    check(`Game setup ${i + 1}: real HTTP 200 and no generic error`, response.status() === 200 && await page.getByRole("heading", { name: /Application error/ }).count() === 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await audit(page, `mobile-game-setup-${i + 1}`);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  checkpoint("profile-empty-and-real-login");
  await page.goto("/profile");
  await expect(page.locator(".credit-panel .stat")).toHaveText("3");
  await expect(page.getByText("لم تبدأ أي مباراة بعد.", { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 }); await audit(page, "mobile-profile-empty");
  // At mobile width the authenticated logout control lives inside the collapsed mobile menu.
  // Exercise the actual accessible mobile control and verify that the signed-in session is gone.
  await page.locator(".mobile-menu > summary").click();
  const logoutResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === "/api/auth/logout" && response.request().method() === "POST");
  await page.locator(".mobile-menu nav").getByRole("button", { name: "خروج", exact: true }).click();
  const logoutResponse = await logoutResponsePromise;
  assert.equal(logoutResponse.status(), 200);
  await page.goto("/games");
  await expect(page).toHaveURL(/\/login/);
  check("Mobile-menu logout revokes session and protects authenticated library");
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
  await mutation(page, page.getByRole("button", { name: "تسجيل الدخول", exact: true }), "/api/auth/login");
  await expect(page).toHaveURL(/\/games$/); await page.reload();
  await expect(page.getByRole("link", { name: /رصيدك: 3 ألعاب/ })).toBeVisible();
  check("Logout, real login and refresh preserve the correct account and wallet");
  checkpoint("create-legacy-board-room");
  await page.getByRole("link", { name: "ابدأ لوحة التحدي", exact: true }).click();
  const categories = page.getByRole("checkbox"); await expect(categories).toHaveCount(6);
  for (let i = 0; i < 6; i++) await categories.nth(i).check();
  await page.getByLabel("ثواني السؤال", { exact: true }).selectOption("60");
  await mutation(page, page.getByRole("button", { name: /جهّز اللوحة/ }), "/api/games/category-board", 201);
  await expect(page).toHaveURL(/\/play\/[^/]+$/);
  const sessionId = new URL(page.url()).pathname.split("/").at(-1);
  check("Preparing board uses no START credit", await wallet() === 3);
  await mutation(page, page.getByRole("button", { name: "أنشئ غرفة برمز", exact: true }), "/api/rooms", 201);
  const code = await page.locator(".room-code").innerText(); assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  const invitePath = await page.getByRole("link", { name: "رابط الانضمام", exact: true }).getAttribute("href");
  check("Room creation and invite preserve wallet", await wallet() === 3);
  writeFileSync(join(output, "journey.private.json"), JSON.stringify({ ownerId, sessionId, code, invitePath }), { mode: 0o600, flag: "wx" });
  await page.reload();
  await expect(page.locator(".room-code")).toHaveText(code);
  check("Host reload automatically restores existing room code and roster");
  const guestContext = await browser.newContext({ baseURL: origin.origin, viewport: { width: 390, height: 844 }, locale: "ar-SA" });
  const guest = await guestContext.newPage(); observe(guest);
  const guests = [{ context: guestContext, page: guest }];
  await guest.goto(invitePath);
  await expect(guest.getByLabel("اسمك في اللعب", { exact: true })).toBeVisible();
  await guest.getByLabel("اسمك في اللعب", { exact: true }).fill("ضيف اختبار محلي");
  await mutation(guest, guest.getByRole("button", { name: "انضم إلى الغرفة", exact: true }), `/api/rooms/${code}/join`, 201);
  await expect(guest).toHaveURL(new RegExp(`/rooms/${code}$`));
  await guest.getByRole("button", { name: "أنا جاهز", exact: true }).click();
  await expect(page.getByText("1 لاعب في الغرفة · 1 جاهزون", { exact: true })).toBeVisible();
  check("Anonymous guest joins through invite UI and live readiness reaches host");
  checkpoint("eight-independent-anonymous-guests");
  for (let index = 2; index <= 8; index++) {
    const context = await browser.newContext({ baseURL: origin.origin, viewport: { width: 390, height: 844 }, locale: "ar-SA" });
    const observer = await context.newPage(); observe(observer);
    await observer.goto(index % 2 === 0 ? invitePath : "/join");
    if (index % 2) {
      await observer.getByLabel("رمز الغرفة", { exact: true }).fill(code);
      await observer.getByRole("button", { name: "ابحث عن الغرفة", exact: true }).click();
    }
    await expect(observer.getByLabel("اسمك في اللعب", { exact: true })).toBeVisible();
    await observer.getByLabel("اسمك في اللعب", { exact: true }).fill(`ضيف اصطناعي ${index}`);
    await mutation(observer, observer.getByRole("button", { name: "انضم إلى الغرفة", exact: true }), `/api/rooms/${code}/join`, 201);
    await expect(observer).toHaveURL(new RegExp(`/rooms/${code}$`));
    await observer.getByRole("button", { name: "أنا جاهز", exact: true }).click();
    guests.push({ context, page: observer });
  }
  await expect(page.getByText("8 لاعب في الغرفة · 8 جاهزون", { exact: true })).toBeVisible();
  check("Owner and eight independent anonymous browser contexts connect through real HTTP using links and codes");
  for (const item of guests) await expect(item.page.locator(".room-person")).toHaveCount(8);
  check("All eight guests synchronize the same complete roster without owner privileges");
  check("Guest cannot read host management API", (await http(guest, `/api/games/category-board/${sessionId}`)).status === 403);
  check("Invite/join/ready do not consume game credit", await wallet() === 3);
  checkpoint("canonical-start-and-answer");
  await mutation(page, page.getByRole("button", { name: "ابدأ المباراة", exact: true }), `/api/games/category-board/${sessionId}/commands`);
  await expect(page.getByRole("heading", { name: "اختاروا السؤال التالي", exact: true })).toBeVisible();
  check("Canonical START consumes exactly one credit", await wallet() === 2);
  await page.reload(); await expect(page.locator(".room-code")).toHaveText(code);
  check("Reloading started board leaves wallet unchanged", await wallet() === 2);
  const firstCell = page.getByRole("button", { name: "اختبار محلي 1 200", exact: true }).first(); // Board36 has two distinct 200-point IDs.
  await mutation(page, firstCell, `/api/games/category-board/${sessionId}/commands`);
  for (const item of guests) await expect(item.page.locator(".room-question h2")).toBeVisible();
  check("The original open game round reaches all eight real guests");
  await guest.getByLabel("إجابتك للمضيف", { exact: true }).fill("إجابة ضيف اصطناعية");
  await mutation(guest, guest.getByRole("button", { name: "أرسل", exact: true }), `/api/rooms/${code}/responses`);
  await expect(page.getByText("ضيف اختبار محلي: إجابة ضيف اصطناعية", { exact: true })).toBeVisible();
  await guest.reload(); await expect(guest.getByRole("button", { name: "وصلت إجابتك", exact: true })).toBeDisabled();
  check("Anonymous response reaches host once and survives reload");
  const duplicate = await http(guest, `/api/rooms/${code}/responses`, "POST", { response: "إجابة ضيف اصطناعية", vote: false });
  check("Duplicate response rejected without new score", duplicate.status === 409);
  check("Guest has no host judgment controls", await guest.getByRole("button", { name: /صحيح/ }).count() === 0);
  await audit(guest, "mobile-legacy-guest");
  await mutation(page, page.getByRole("button", { name: "اكشف الإجابة", exact: true }), `/api/games/category-board/${sessionId}/commands`);
  await expect(guest.locator(".answer-reveal")).toBeVisible();
  await mutation(page, page.getByRole("button", { name: /^صحيح/ }), `/api/games/category-board/${sessionId}/commands`);
  await expect(page.getByRole("button", { name: "اختبار محلي 1 200 مستخدم", exact: true })).toBeDisabled();
  check("Host legitimately judges response and score is saved");
  await guests[7].page.close();
  checkpoint("complete-all-board-cells");
  for (let i = 0; i < 35; i++) {
    await mutation(page, page.locator(".board-cell:not([disabled])").first(), `/api/games/category-board/${sessionId}/commands`);
    await mutation(page, page.getByRole("button", { name: "تخطي", exact: true }), `/api/games/category-board/${sessionId}/commands`);
    if (i === 1) {
      for (const item of guests.slice(0, 7)) {
        await expect(item.page.locator(".room-person")).toHaveCount(8);
        const observed = await http(item.page, `/api/rooms/${code}`);
        assert.equal(observed.status, 200); assert.equal(observed.body.session.round, 3);
      }
      check("Closing one guest page leaves owner and seven other live guests usable through two further rounds");
      const reconnected = await guests[7].context.newPage(); observe(reconnected);
      await reconnected.goto(`/rooms/${code}`);
      await expect(reconnected.locator(".room-person").filter({ hasText: " · أنت" })).toHaveCount(1);
      check("Disconnected guest resumes the same cookie-bound seat without host controls", await reconnected.getByRole("link", { name: "ارجع إلى تحكم المضيف", exact: true }).count() === 0);
      guests[7].page = reconnected;
    }
  }
  await expect(page.getByRole("heading", { name: "الفائز: فريق البرق", exact: true })).toBeVisible();
  for (const item of guests) {
    await expect(item.page.getByRole("heading", { name: "انتهت المباراة", exact: true })).toBeVisible();
    await expect(item.page.locator(".team-score b")).toHaveText(["200", "0"]);
    await expect(item.page.getByRole("link", { name: "ارجع إلى تحكم المضيف", exact: true })).toHaveCount(0);
  }
  check("All thirty-six cells genuinely resolved through exact-key UI, final result reaches all eight guests");
  check("All eight guests retain identical final 200–0 scores and no management controls");
  await audit(page, "mobile-board-results", true);
  check("Finishing board and room adds no extra debit", await wallet() === 2);
  const debits = (await pool.query('SELECT count(*)::int AS n FROM "GameCredit" WHERE "userId"=$1 AND "idempotencyKey"=$2 AND delta=-1', [ownerId, `game-start:${sessionId}`])).rows[0].n;
  check("Database ledger has exactly one canonical game-start debit", debits === 1);
  await page.goto("/profile");
  await page.getByRole("link", { name: "عرض النتيجة", exact: true }).click();
  await expect(page.getByRole("heading", { name: "الفائز: فريق البرق", exact: true })).toBeVisible();
  check("Account history result link restores completed match");
  checkpoint("new-room-after-completed-result");
  await page.goto("/games/category-board/new");
  for (let i = 0; i < 6; i++) await page.getByRole("checkbox").nth(i).check();
  await mutation(page, page.getByRole("button", { name: /جهّز اللوحة/ }), "/api/games/category-board", 201);
  await expect(page).toHaveURL(/\/play\/[^/]+$/);
  check("Navigating to a fresh match does not retain the previous room code", await page.locator(".room-code").count() === 0);
  await mutation(page, page.getByRole("button", { name: "أنشئ غرفة برمز", exact: true }), "/api/rooms", 201);
  const freshCode = await page.locator(".room-code").innerText();
  await expect(page.getByText("0 لاعب في الغرفة · 0 جاهزون", { exact: true })).toBeVisible();
  await expect(page.locator(".team-score b")).toHaveText(["0", "0"]);
  check("The new room has a distinct code with an empty roster and zero scores", freshCode !== code);
  check("New lobby preparation preserves wallet after exactly one original START", await wallet() === 2);
  checkpoint("remaining-beta-navigation");
  for (const [path, name] of [["/night", "night"], ["/shillatak", "shillatak"]]) {
    const response = await page.goto(path); check(`${name} navigation reachable with enabled feature flag`, response.status() === 200);
    await audit(page, `mobile-${name}-empty`);
  }
  await guest.goto("/join"); await guest.getByLabel("رمز الغرفة", { exact: true }).fill("AAAAAA");
  await guest.getByRole("button", { name: "ابحث عن الغرفة", exact: true }).click();
  await expect(guest.getByRole("alert")).toBeVisible();
  check("Invalid room gives a visible sanitized Arabic error");
  check("No uncaught browser exceptions or off-origin browser requests", result.errors.pageExceptions === 0 && result.errors.externalRequests === 0);
  check("Browser console errors contain only deliberately tested forbidden, duplicate and missing-room HTTP responses",
    Object.keys(result.errors.consoleErrorCategories).every(category => ["http-403", "http-409", "http-404"].includes(category)));
  check("Failed requests contain only observed navigation and event-stream aborts",
    Object.keys(result.errors.failedRequestCategories).every(category => category.endsWith(":net::ERR_ABORTED")));
  result.status = "PASSED";
} catch (error) {
  result.status = "FAILED"; result.failureStep = step;
  result.failureClass = error instanceof Error ? error.constructor.name : "Unknown";
  // URLs, raw assertions, DOM, invitation codes, cookies and user data stay private.
  writeFileSync(join(output, "failure.private.json"), JSON.stringify({ message: error instanceof Error ? error.message : "unknown", stack: error instanceof Error ? error.stack : null }), { mode: 0o600 });
  process.exitCode = 1;
} finally {
  result.finishedAt = new Date().toISOString(); result.passed = result.checks.length;
  writeFileSync(join(output, "receipt.json"), JSON.stringify(result, null, 2), { mode: 0o600, flag: "wx" });
  await browser?.close(); await pool.end();
  console.log(JSON.stringify({ status: result.status, passed: result.checks.length, failureStep: result.failureStep ?? null, evidence: output }));
}
