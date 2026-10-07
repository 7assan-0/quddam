import { readFileSync, appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { request as httpsRequest } from "node:https";
import { expect, test, type BrowserContext, type Page, type APIRequestContext, type Browser } from "@playwright/test";
import type { Fixture, Game } from "../../scripts/database-lifecycle-fixtures";
const origin = "https://localhost:3443", out = process.env.I1_OUTPUT!;
const fixture = JSON.parse(readFileSync(out + "/fixture-private.json", "utf8")) as { hostToken: string; adminToken: string; revokedToken: string; fixtures: Fixture[]; phone: { id: string; code: string; phoneToken: string } };
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const prefixes: Record<Game, string> = { board: "games/category-board", social: "social", letter: "letter-network", survey: "survey-show", forbidden: "secret-word", bluff: "bluff", ranked: "ranked", lightning: "lightning", ordering: "ordering", court: "court" };
const paths: Record<Game, string> = { board: "/play", social: "/social/host", letter: "/letter-network/host", survey: "/survey-show/host", forbidden: "/secret-word/host", bluff: "/bluff/host", ranked: "/ranked/host", lightning: "/lightning/host", ordering: "/ordering/host", court: "/court/host" };
const selectors: Record<Game, string> = { board: ".host-game", social: ".social-page", letter: ".letter-page", survey: ".survey-host", forbidden: ".forbidden-host", bluff: ".bluff-host", ranked: ".ranked-host", lightning: ".lightning-host", ordering: ".ordering-host", court: ".court-host" };
const get = (game: Game) => fixture.fixtures.find(f => f.game === game)!;
type V = { version: number; phase: string; teams: { id: string; score: number }[]; cells?: { completed: boolean; categoryId: string; value: number }[]; active?: { revealed: boolean; deadlineAt: string | null }; entries?: { answer?: string; revealed: boolean }[]; slots?: { answer?: string; revealed: boolean }[]; board?: { revealed: boolean; answer?: string; points?: number }[] };
async function auth(context: BrowserContext, token = fixture.hostToken) { await context.addCookies([{ name: "qalba_session", value: token, url: origin, secure: true, httpOnly: true, sameSite: "Lax" }]); }
async function current(request: APIRequestContext, f: Fixture): Promise<V> { const r = await request.get(`/api/${prefixes[f.game]}/${f.id}`); expect(r.status()).toBe(200); return r.json(); }
async function command(request: APIRequestContext, f: Fixture, action: object) { const v = await current(request, f), r = await request.post(`/api/${prefixes[f.game]}/${f.id}/commands`, { headers: { Origin: origin }, data: { key: randomUUID(), expectedVersion: v.version, action } }); expect(r.status()).toBe(200); return current(request, f); }
async function browserCommand(page: Page, f: Fixture, action: object) {
  const result = await page.evaluate(async ({ prefix, id, action }) => {
    const current = await fetch(`/api/${prefix}/${id}`), v = await current.json();
    const response = await fetch(`/api/${prefix}/${id}/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: crypto.randomUUID(), expectedVersion: v.version, action }) });
    return { status: response.status };
  }, { prefix: prefixes[f.game], id: f.id, action }); expect(result.status).toBe(200);
}
async function link(request: APIRequestContext, f: Fixture, kind = "display", body?: object): Promise<string> { const r = await request.post(`/api/${prefixes[f.game]}/${f.id}/${kind}-access`, { headers: { Origin: origin }, data: body }); expect(r.status()).toBe(200); return (await r.json()).url; }
async function openDocument(page: Page, url: string) {
  const response = await page.goto(url); expect(response?.status()).toBe(200);
  const h = response!.headers();
  appendFileSync(out + "/Header-Matrix.ndjson", JSON.stringify({ route: new URL(url, origin).pathname, status: response!.status(), headers: Object.fromEntries(Object.entries(h).filter(([key]) => /security|policy|cache-control|frame|content-type-options/.test(key)).map(([k, v]) => [k, v.replace(/'nonce-[^']+'/g, "'nonce-[REDACTED]'" )])) }) + "\n");
  expect(h["content-security-policy-report-only"]).toContain("strict-dynamic"); expect(h["content-security-policy"]).toBeUndefined();
  const nonce = /'nonce-([^']+)'/.exec(h["content-security-policy-report-only"])![1];
  const html = await response!.text(), serverScripts = [...html.matchAll(/<script([^>]*)>/g)].map(match => match[1]);
  const nonces = await page.locator("script").evaluateAll(tags => tags.map(t => ({ nonce: (t as HTMLScriptElement).nonce, source: (t as HTMLScriptElement).src ? new URL((t as HTMLScriptElement).src).pathname : "inline" })));
  appendFileSync(out + "/Nonce-Diagnostics.ndjson", JSON.stringify({ route: new URL(url, origin).pathname, serverScripts: serverScripts.length, serverMatches: serverScripts.filter(tag => tag.includes(`nonce="${nonce}"`)).length, dom: nonces.map(t => ({ source: t.source, matches: t.nonce === nonce, hasNonce: Boolean(t.nonce) })) }) + "\n");
  expect(serverScripts.length).toBeGreaterThan(0); expect(serverScripts.every(tag => tag.includes(`nonce="${nonce}"`))).toBe(true);
  expect(h["cache-control"]).toMatch(/no-store/); return nonce;
}
const clean = (message: string) => message.replace(/https?:\/\/[^\s"'<>)]+/g, value => { try { const u = new URL(value); return u.origin + u.pathname + (u.search ? "?[REDACTED]" : ""); } catch { return "[URL]"; } }).replace(/'nonce-[^']+'/g, "'nonce-[REDACTED]'").slice(0, 800);
type Violation = { directive: string; disposition: string; resourceClass: string; status: number; synthetic: boolean };
const observations = new WeakMap<BrowserContext, { violations: Violation[]; console: { category: string; level: string; message: string }[]; runtimeErrors: number }>();
type Observation = { violations: Violation[]; console: { category: string; level: string; message: string }[]; runtimeErrors: number };
const extraContexts = new WeakMap<BrowserContext, BrowserContext[]>();
async function instrumentContext(context: BrowserContext, observation: Observation, title: string) {
  observations.set(context, observation);
  await context.exposeBinding("__i1Violation", (_source, value: Violation) => observation.violations.push(value));
  await context.addInitScript(() => {
    type Instrumented = Window & { __i1Synthetic?: boolean; __i1Violation: (value: Violation) => Promise<void> };
    const w = window as unknown as Instrumented;
    document.addEventListener("securitypolicyviolation", e => { let resourceClass = e.blockedURI; try { resourceClass = new URL(e.blockedURI).origin; } catch { /* inline/eval stay classes */ } void w.__i1Violation({ directive: e.effectiveDirective, disposition: e.disposition, resourceClass, status: e.statusCode, synthetic: Boolean(w.__i1Synthetic) }); });
  });
  const observePage = (page: Page) => {
    page.on("pageerror", () => observation.runtimeErrors++);
    page.on("response", response => { const path = new URL(response.url()).pathname; if (path.startsWith("/api/") && path.endsWith("/events")) { const h = response.headers(); appendFileSync(out + "/SSE-Headers.ndjson", JSON.stringify({ route: path, status: response.status(), type: h["content-type"], cache: h["cache-control"], referrer: h["referrer-policy"], nosniff: h["x-content-type-options"], cspDocumentPolicyAbsent: !h["content-security-policy-report-only"] }) + "\n"); } });
    page.on("console", msg => {
      if (!["error", "warning"].includes(msg.type())) return;
      const csp = /Content Security Policy|violates.*directive|Refused to.*policy/i.test(msg.text());
      const expectedProbe = title === "I1 synthetic cross-origin framing is denied by existing enforced frame protection" && /frame-ancestors 'none'/.test(msg.text());
      observation.console.push({ category: csp ? expectedProbe ? "A_EXPECTED_SYNTHETIC" : "B_APPLICATION_CSP" : /ERR_INTERNET_DISCONNECTED|status of 404|status of 413|status of 400/.test(msg.text()) ? "C_CONTROLLED_TRANSPORT_OR_HTTP" : "C_OTHER_WARNING", level: msg.type(), message: clean(msg.text()) });
    });
  };
  context.pages().forEach(observePage); context.on("page", observePage);
}
async function surface(browser: Browser, main: BrowserContext, title: string, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true, viewport });
  await instrumentContext(context, observations.get(main)!, title);
  extraContexts.set(main, [...(extraContexts.get(main) ?? []), context]); return context.newPage();
}
test.beforeEach(async ({ context }, info) => {
  await instrumentContext(context, { violations: [], console: [], runtimeErrors: 0 }, info.title);
});
test.afterEach(async ({ context }, info) => {
  for (const extra of extraContexts.get(context) ?? []) await extra.close();
  const o = observations.get(context)!; const unexpected = o.violations.filter(v => !(info.title === "I1 synthetic report-only violation is observable and does not enforce" && v.synthetic && v.directive === "script-src-elem" && v.resourceClass === "inline" && v.disposition === "report"));
  appendFileSync(out + "/Browser-Console.ndjson", JSON.stringify({ test: info.title, ...o, unexplainedViolations: unexpected.length }) + "\n");
  expect(unexpected.length, "unexplained application CSP violations").toBe(0); expect(o.console.filter(c => c.category === "B_APPLICATION_CSP").length, "unexplained application CSP console messages").toBe(0); expect(o.runtimeErrors, "application runtime errors").toBe(0);
});
test.afterAll(async () => { await pool.end(); });

for (const game of Object.keys(paths) as Game[]) test(`I1 ${game}: production Host START interaction TV and player compatibility`, async ({ context, page, browser }, info) => {
  await auth(context); const f = get(game); await openDocument(page, paths[game] + "/" + f.id); await expect(page.locator(selectors[game])).toBeVisible();
  await browserCommand(page, f, { type: "START" });
  if (game === "board") { const v = await current(page.request, f), c = v.cells!.find(c => !c.completed)!; await browserCommand(page, f, { type: "OPEN", categoryId: c.categoryId, value: c.value }); }
  else if (game === "social") await browserCommand(page, f, { type: "BEGIN_DISCUSSION" });
  else if (game === "letter") { const st = (await pool.query('SELECT state FROM "GameSession" WHERE id=$1', [f.id])).rows[0].state as { board: { cellId: string; state: string }[] }; await browserCommand(page, f, { type: "SELECT_CELL", cellId: st.board.find(c => c.state === "AVAILABLE")!.cellId }); await browserCommand(page, f, { type: "OPEN_QUESTION" }); }
  else if (game === "survey" || game === "ranked" || game === "ordering" || game === "bluff" || game === "court") { await browserCommand(page, f, { type: "START_ROUND" }); if (game === "court") await browserCommand(page, f, { type: "START_PREPARATION" }); }
  else if (game === "forbidden") { await browserCommand(page, f, { type: "PREPARE_ROUND" }); await browserCommand(page, f, { type: "START_ROUND" }); }
  else if (game === "lightning") { await browserCommand(page, f, { type: "PREPARE_QUESTION" }); await browserCommand(page, f, { type: "OPEN_BUZZ" }); }
  if (game === "letter") { await page.getByRole("button", { name: "فتح شاشة العرض", exact: true }).click(); const qr = page.locator('img[src^="data:image/"]'); await expect(qr).toBeVisible(); expect(await qr.evaluate(img => (img as HTMLImageElement).naturalWidth > 0)).toBe(true); }
  const display = await link(page.request, f), tv = await surface(browser, context, info.title, { width: 1920, height: 1080 }); await tv.setViewportSize({ width: 1920, height: 1080 }); await openDocument(tv, display); await expect(tv.locator("main, .display-screen").first()).toBeVisible();
  await expect(tv.getByRole("button", { name: /تراجع عن آخر إجراء|إنهاء المباراة/ })).toHaveCount(0);
  const displayURL = new URL(display, origin), token = displayURL.searchParams.get("token")!;
  const tvAPI = game === "board" ? `/api/display/${f.id}?token=${token}` : `/api/${prefixes[game]}/${f.id}/display?token=${token}`;
  const projection = await tv.request.get(tvAPI); expect(projection.status()).toBe(200); const publicView = await projection.json();
  if (game === "social") {
    const round = (await pool.query('SELECT "outsiderId","wordSnapshot" FROM "SocialRound" WHERE "sessionId"=$1 ORDER BY number DESC LIMIT 1', [f.id])).rows[0];
    expect(Boolean(JSON.stringify(publicView).includes(round.wordSnapshot))).toBe(false);
    const player = await surface(browser, context, info.title); const pc = player.context();
    const normal = f.people.find(p => p.id !== round.outsiderId)!;
    await pc.addCookies([{ name: `qalba_social_${f.id}`, value: normal.token, url: origin, httpOnly: true, secure: true }]);
    const allowed = await pc.request.get(`/api/social/${f.id}/player`); expect(allowed.status()).toBe(200); expect((await allowed.json()).self.secretWord === round.wordSnapshot).toBe(true);
    const outsider = f.people.find(p => p.id === round.outsiderId)!;
    await pc.addCookies([{ name: `qalba_social_${f.id}`, value: outsider.token, url: origin, httpOnly: true, secure: true }]); await openDocument(player, `/social/play/${f.id}`); const r = await pc.request.get(`/api/social/${f.id}/player`); expect(r.status()).toBe(200); expect(Boolean(JSON.stringify(await r.json()).includes(round.wordSnapshot))).toBe(false); expect(Boolean((await player.locator("body").innerText()).includes(round.wordSnapshot))).toBe(false);
  } else if (game === "letter") { expect(publicView.question).not.toBeNull(); expect(publicView.question.answer).toBeUndefined(); expect(publicView.question.alternativeAnswers).toBeUndefined(); expect(publicView.lastAnswer).toBeNull(); }
  else if (game === "survey") { expect(publicView.board.every((s: { revealed: boolean; answer?: string; points?: number }) => !s.revealed && s.answer === undefined && s.points === undefined)).toBe(true); }
  else if (game === "ranked") { const slots = publicView.slots ?? publicView.entries; expect(slots.every((s: { revealed: boolean; answer?: string }) => !s.revealed && s.answer === undefined)).toBe(true); }
  else if (game === "court") { expect(publicView.results).toHaveLength(0); expect(publicView.voteTotals).toBeUndefined(); expect(publicView.votes).toBeUndefined(); const player = await surface(browser, context, info.title); await player.context().addCookies([{ name: `qalba_court_${f.id}`, value: f.people[0].token, url: origin, secure: true, httpOnly: true }]); await player.setViewportSize({ width: 390, height: 844 }); await openDocument(player, `/court/play/${f.id}`);
    for (let i = 0; i < 5; i++) await browserCommand(page, f, { type: "ADVANCE_PHASE" });
    await player.getByRole("button", { name: "مع الادعاء", exact: true }).click(); await expect(player.getByText("تم تسجيل صوتك", { exact: false })).toBeVisible();
    const privateBeforeVerdict = await (await context.request.get(tvAPI)).json(); expect(privateBeforeVerdict.voteCount).toBe(1); expect(privateBeforeVerdict.verdict).toBeNull(); expect(privateBeforeVerdict.results).toHaveLength(0); expect(privateBeforeVerdict.self).toBeUndefined(); expect(privateBeforeVerdict.votes).toBeUndefined(); }
  else if (game === "bluff") { expect(publicView.reveal).toBeNull(); const player = await surface(browser, context, info.title); await player.context().addCookies([{ name: `qalba_bluff_${f.id}`, value: f.people[0].token, url: origin, secure: true, httpOnly: true }]); await player.setViewportSize({ width: 390, height: 844 }); await openDocument(player, `/bluff/play/${f.id}`); }
  else if (game === "forbidden") { const player = await surface(browser, context, info.title); await player.setViewportSize({ width: 390, height: 844 }); await openDocument(player, await link(page.request, f, "clue")); }
  else if (game === "lightning" || game === "ordering") { const v = await current(page.request, f), player = await surface(browser, context, info.title); await player.setViewportSize({ width: 390, height: 844 }); await openDocument(player, await link(page.request, f, game === "lightning" ? "buzzer" : "controller", { teamId: v.teams[0].id })); }
  else if (game === "board") { const phone = await surface(browser, context, info.title); await phone.context().addCookies([{ name: `qalba_room_${fixture.phone.code}`, value: fixture.phone.phoneToken, url: origin, secure: true, httpOnly: true }]); await phone.setViewportSize({ width: 390, height: 844 }); await openDocument(phone, `/rooms/${fixture.phone.code}`); }
  // Meaningful round progression is committed through existing command endpoints; no engine changes.
  const fresh = await current(page.request, f); expect(fresh.version).toBeGreaterThan(1); await tv.reload();
});

test("I1 navigation/auth/admin/assets/error policy and nonce isolation", async ({ page, context }) => {
  const first = await openDocument(page, "/login"); await page.getByLabel("البريد الإلكتروني").fill("f1-host@example.test"); await page.getByLabel("كلمة المرور", { exact: true }).fill("synthetic-security-123456"); await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click(); await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/profile"); await expect(page.locator("body")).toContainText("قدّام"); expect((await context.cookies()).find(c => c.name === "qalba_session")?.secure).toBe(true);
  const links = await page.locator('a[href*="/social/host/"],a[href*="/letter-network/host/"]').count(); expect(links).toBeGreaterThanOrEqual(2);
  await page.goto("/games"); await expect(page.locator(".game-card")).toHaveCount(10); await page.locator('.library-balance a[href="/profile"]').click(); await expect(page).toHaveURL(/\/profile$/); await page.goto("/login");
  await page.evaluate(() => document.fonts.ready); expect(await page.evaluate(() => [...document.fonts].some(font => font.status === "loaded"))).toBe(true);
  const second = /'nonce-([^']+)'/.exec((await page.reload())!.headers()["content-security-policy-report-only"])![1]; expect(second).not.toBe(first);
  for (const path of ["/icon.svg", "/brand/quddam-mark.svg", "/fonts/NotoSansArabic-Regular.ttf"]) { const r = await context.request.get(path); expect(r.status()).toBe(200); expect(r.headers()["x-content-type-options"]).toBe("nosniff"); }
  await auth(context, fixture.adminToken); await openDocument(page, "/admin");
  const r = await page.goto("/not-a-quddam-route"); expect(r?.status()).toBe(404); expect(r?.headers()["content-security-policy-report-only"]).toContain("object-src 'none'");
  expect((await context.request.post("/api/auth/logout", { headers: { Origin: "https://untrusted.example" } })).status()).toBe(403);
});

test("I1 synthetic report-only violation is observable and does not enforce", async ({ page }) => {
  await openDocument(page, "/login");
  // Parser-inserted fixture: strict-dynamic intentionally trusts scripts added by trusted runtime loaders.
  await page.addInitScript(() => { (window as unknown as { __i1Synthetic: boolean }).__i1Synthetic = true; });
  await page.route("**/login", async route => { const response = await route.fetch(); const html = await response.text(); await route.fulfill({ response, body: html.replace("</head>", "<script>window.__syntheticExecuted=true</script></head>") }); });
  await page.goto("/login");
  await expect.poll(() => observations.get(page.context())!.violations.filter(v => v.synthetic).length).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { __syntheticExecuted: boolean }).__syntheticExecuted)).toBe(true);
  const v = observations.get(page.context())!.violations.find(v => v.synthetic)!; expect(v.disposition).toBe("report"); expect(v.directive).toBe("script-src-elem"); expect(v.resourceClass).toBe("inline");
});

test("I1 fake payment top-level redirect return polling and cancel preserve settlement", async ({ context, page }) => {
  // Preserve the real provider hostname contract; fulfill every hosted request locally before network access.
  await context.route("https://checkout.moyasar.com/**", async route => { const u = new URL(route.request().url()); const response = await route.fetch({ url: "https://localhost:3444" + u.pathname + u.search, maxRedirects: 0 }); await route.fulfill({ response }); });
  await auth(context); await openDocument(page, "/pricing"); const checkout = page.waitForResponse(r => new URL(r.url()).pathname === "/api/billing/checkout"); await page.getByRole("button", { name: "شراء الرصيد" }).first().click(); expect((await checkout).status()).toBe(200); await expect(page).toHaveURL(/https:\/\/checkout.moyasar.com\/invoices\//);
  await page.getByRole("link", { name: "تأكيد الدفع التجريبي" }).click(); await expect(page).toHaveURL(/\/billing\/return\?purchase=/); await page.getByRole("button", { name: "تحقق من الدفع" }).click(); await expect(page.getByRole("heading", { name: "اكتمل الشراء وأضيف الرصيد" })).toBeVisible();
  const id = new URL(page.url()).searchParams.get("purchase")!; const again = await context.request.post(`/api/billing/purchases/${id}`, { headers: { Origin: origin } }); expect(again.status()).toBe(200); expect((await again.json()).status).toBe("PAID");
  await page.goto("/pricing"); await page.getByRole("button", { name: "شراء الرصيد" }).first().click(); await expect(page).toHaveURL(/checkout.moyasar.com/); await page.getByRole("link", { name: "إلغاء التجربة" }).click(); await expect(page).toHaveURL(/\/pricing$/);
});

test("I1 synthetic cross-origin framing is denied by existing enforced frame protection", async ({ context, page }) => {
  await context.addInitScript(() => { (window as unknown as { __i1Synthetic: boolean }).__i1Synthetic = true; });
  await page.goto("https://localhost:3444/frame");
  await expect.poll(() => page.frames().some(frame => frame.url().startsWith("chrome-error://"))).toBe(true);
  expect(page.frames().some(frame => frame.url() === origin + "/login")).toBe(false);
});

test("I1 Board Undo TV phone deadline and reconnect across thirty seconds", async ({ context, page, browser }, info) => {
  await auth(context); const f = get("board"), tvURL = await link(page.request, f), tv = await context.newPage(); await openDocument(tv, tvURL);
  await command(page.request, f, { type: "TIMER_START" });
  const phone = await surface(browser, context, info.title); const pc = phone.context();
  await pc.addCookies([{ name: `qalba_room_${fixture.phone.code}`, value: fixture.phone.phoneToken, url: origin, secure: true, httpOnly: true }]); await phone.setViewportSize({ width: 390, height: 844 }); await openDocument(phone, `/rooms/${fixture.phone.code}`); const timer = phone.getByLabel("الوقت المتبقي"); await expect(timer).toBeVisible(); const first = Number(await timer.getAttribute("data-ms")); expect(first).toBeGreaterThan(40_000);
  await command(page.request, f, { type: "PAUSE_GAME" }); await expect(timer).toContainText("متوقفة"); const paused = await timer.getAttribute("data-ms"); await phone.waitForTimeout(400); expect(await timer.getAttribute("data-ms")).toBe(paused);
  await command(page.request, f, { type: "RESUME_GAME" }); await expect(timer).not.toContainText("متوقفة"); const deadline = (await current(page.request, f)).active!.deadlineAt; await phone.reload(); expect((await current(page.request, f)).active!.deadlineAt).toBe(deadline);
  const answer = await pc.request.post(`/api/rooms/${fixture.phone.code}/responses`, { headers: { Origin: origin }, data: { response: "مشاركة التوافق", vote: false } }); expect(answer.status()).toBe(200);
  const before = await current(page.request, f); await command(page.request, f, { type: "CORRECT" }); await command(page.request, f, { type: "UNDO" }); const after = await current(page.request, f); expect(after.teams).toEqual(before.teams); expect(after.cells).toEqual(before.cells);
  await expect(tv.locator(".display-cell.done")).toHaveCount(0); await tv.reload(); await expect(tv.locator(".display-question h1")).toBeVisible();
  let streams = 0, polls = 0; for (const surface of [tv, phone]) surface.on("request", r => { const path = new URL(r.url()).pathname; if (path.endsWith("/events")) streams++; else if (path.startsWith("/api/")) polls++; });
  const dedicated = await context.newPage(); await openDocument(dedicated, paths.court + "/" + get("court").id); await page.waitForTimeout(32_000);
  await command(page.request, f, { type: "REVEAL" }); await expect(tv.locator(".display-answer")).toBeVisible(); expect(streams).toBeLessThanOrEqual(2); expect(polls).toBeLessThanOrEqual(3);
  await tv.reload(); await expect(tv.locator(".display-answer")).toBeVisible();
  const oldToken = new URL(tvURL, origin).searchParams.get("token")!; expect((await page.request.delete(`/api/${prefixes.board}/${f.id}/display-access`, { headers: { Origin: origin } })).status()).toBe(200); expect((await page.request.get(`/api/display/${f.id}?token=${oldToken}`)).status()).toBe(403);
  // Existing L02 supports at most three simultaneous display links, not replacement on each mint.
  const freshURL = await link(page.request, f); await openDocument(tv, freshURL); await expect(tv.locator(".display-answer")).toBeVisible();
});

test("I1 dedicated SSE transient reconnect and H01 exact-session revocation", async ({ context, page }) => {
  await auth(context, fixture.revokedToken); const f = get("ranked"); await openDocument(page, paths.ranked + "/" + f.id); await expect(page.locator(selectors.ranked)).toBeVisible();
  await context.setOffline(true); await page.waitForTimeout(700); await context.setOffline(false); await expect(page.locator(selectors.ranked)).toBeVisible();
  const stream = await page.evaluate(async id => {
    const state = { states: 0, terminal: false, done: false }; (window as unknown as { __stream: typeof state }).__stream = state;
    const response = await fetch(`/api/ranked/${id}/events?audience=host`); const reader = response.body!.getReader();
    void (async () => { const decoder = new TextDecoder(); let text = ""; while (true) { const result = await reader.read(); if (result.done) { state.done = true; break; } text += decoder.decode(result.value, { stream: true }); const frames = text.split("\n\n"); text = frames.pop()!; for (const frame of frames) { if (frame.includes("event: state")) state.states++; if (frame.includes("event: access-ended")) state.terminal = true; } } })(); return response.status;
  }, f.id); expect(stream).toBe(200);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __stream: { states: number } }).__stream.states)).toBeGreaterThan(0);
  expect((await context.request.post("/api/auth/logout", { headers: { Origin: origin } })).status()).toBe(200);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __stream: { terminal: boolean } }).__stream.terminal), { timeout: 35_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __stream: { done: boolean } }).__stream.done)).toBe(true);
  const count = await page.evaluate(() => (window as unknown as { __stream: { states: number } }).__stream.states); await page.waitForTimeout(1200); expect(await page.evaluate(() => (window as unknown as { __stream: { states: number } }).__stream.states)).toBe(count);
});

test("I1 ingress streaming callback/admin and security-header response matrix", async ({ context, page }) => {
  await auth(context, fixture.adminToken); await openDocument(page, "/admin");
  for (const [path, status] of [["/", 200], ["/login", 200], ["/profile", 200], ["/admin", 200], ["/icon.svg", 200], ["/not-a-quddam-route", 404]] as const) { const r = await context.request.get(path); expect(r.status()).toBe(status); const h = r.headers(); expect(h["referrer-policy"]).toBe("no-referrer"); expect(h["x-frame-options"]).toBe("DENY"); expect(h["cross-origin-opener-policy"]).toBe("same-origin"); expect(h["cross-origin-resource-policy"]).toBe("same-origin"); expect(h["strict-transport-security"]).toBe("max-age=31536000"); appendFileSync(out + "/Header-Matrix.ndjson", JSON.stringify({ route: path, status: r.status(), headers: Object.fromEntries(Object.entries(h).filter(([key]) => /security|policy|cache-control|frame|content-type-options/.test(key)).map(([k, v]) => [k, v.replace(/'nonce-[^']+'/g, "'nonce-[REDACTED]'")])) }) + "\n"); }
  const over = await context.request.post("/api/auth/login", { headers: { Origin: origin }, data: "x".repeat(20000) }); expect(over.status()).toBe(413); expect(over.headers()["cache-control"]).toContain("no-store");
  const streamed = await new Promise<{ status: number; chunksSent: number }>((resolve, reject) => {
    let chunksSent = 0, settled = false;
    const req = httpsRequest(origin + "/api/auth/login", { method: "POST", rejectUnauthorized: false, headers: { Origin: origin, "Content-Type": "application/json" } }, res => { settled = true; clearInterval(timer); res.resume(); res.on("end", () => { req.destroy(); resolve({ status: res.statusCode!, chunksSent }); }); });
    req.on("error", error => { if (!settled) { clearInterval(timer); reject(error); } });
    const timer = setInterval(() => { chunksSent++; req.write(Buffer.alloc(4096, 32)); if (chunksSent === 40) { clearInterval(timer); req.end(); } }, 10);
  }); expect(streamed.status).toBe(413); expect(streamed.chunksSent).toBeLessThan(40);
  appendFileSync(out + "/Streamed-Ingress.json", JSON.stringify({ status: streamed.status, chunksSent: streamed.chunksSent, contentLengthAbsent: true, chunkBytes: 4096, producerStoppedEarly: true }));
  const callback = await context.request.post("/api/billing/callback?token=" + process.env.MOYASAR_CALLBACK_TOKEN, { data: "x".repeat(20000) }); expect(callback.status()).toBe(413);
  const invalid = await context.request.post("/api/admin/questions/import", { headers: { Origin: origin }, data: { csv: "invalid,headers\nTODO,test", dryRun: false } }); expect(invalid.status()).toBe(400);
});
