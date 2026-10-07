import { readFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import type { getBoardSession } from "../../src/lib/games/category-board/service";
type Board = Awaited<ReturnType<typeof getBoardSession>>;
type Fixture = { hostToken: string; adminToken: string; refundToken: string; phone: { id: string; code: string; phoneToken: string }; tv: { id: string; token: string }; fixtures: { id: string; game: string }[] };
const origin = "http://127.0.0.1:3000", out = process.env.H1_OUTPUT!;
const fixture: Fixture = JSON.parse(readFileSync(out + "/fixture-private.json", "utf8"));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
test.afterAll(async () => { await pool.end(); });
async function auth(context: BrowserContext, token = fixture.hostToken) { await context.addCookies([{ name: "qalba_session", value: token, url: origin, httpOnly: true, sameSite: "Lax" }]); }
async function current(request: APIRequestContext, id: string): Promise<Board> { const r = await request.get(`/api/games/category-board/${id}`); expect(r.status()).toBe(200); return r.json(); }
async function command(request: APIRequestContext, id: string, action: object) { const v = await current(request, id); const r = await request.post(`/api/games/category-board/${id}/commands`, { headers: { Origin: origin }, data: { key: randomUUID(), expectedVersion: v.version, action } }); expect(r.status()).toBe(200); return current(request, id); }
const logical = (v: Board) => ({ status: v.status, version: v.version, teams: v.teams, cells: v.cells, active: v.active, turn: v.turnTeamId, round: v.round, ended: v.endedAt });
async function open(request: APIRequestContext, id: string) { const v = await current(request, id), cell = v.cells.find(c => !c.completed)!; return command(request, id, { type: "OPEN", categoryId: cell.categoryId, value: cell.value }); }
async function assertTV(page: Page, request: APIRequestContext, id: string, token: string) {
  const authoritative = await current(request, id);
  const r = await page.request.get(`/api/display/${id}?token=${token}`); expect(r.status()).toBe(200);
  expect(logical(await r.json())).toEqual(logical(authoritative));
  await expect(page.locator(".display-cell.done")).toHaveCount(authoritative.cells.filter(c => c.completed).length);
  for (let i = 0; i < authoritative.teams.length; i++) await expect(page.locator(".display-team").nth(i).locator("strong")).toHaveText(String(authoritative.teams[i].score));
  if (authoritative.active) { await expect(page.locator(".display-question h1")).toHaveText(authoritative.active.question); await expect(page.locator(".display-victory")).toHaveCount(0); }
  if (!authoritative.active?.revealed) await expect(page.locator(".display-answer")).toHaveCount(0);
  const activeTeam = authoritative.active?.answeringTeamId ?? authoritative.turnTeamId;
  if (authoritative.status !== "COMPLETED") await expect(page.locator(".display-team--active")).toContainText(authoritative.teams.find(t => t.id === activeTeam)!.name);
  await expect(page.getByRole("button", { name: /صحيح|تراجع عن آخر إجراء|إنهاء المباراة/ })).toHaveCount(0);
}
async function capture(page: Page, name: string) { mkdirSync(out + "/screenshots", { recursive: true }); await page.screenshot({ path: out + "/screenshots/" + name + ".png", fullPage: true }); }

test("L01 connected TV correct/wrong/steal Undo restores authoritative state and reconnect", async ({ page, browser }) => {
  await auth(page.context()); const id = fixture.tv.id, token = fixture.tv.token;
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } }), tv = await context.newPage();
  try {
    await tv.goto(`/display/${id}?token=${token}`);
    for (const kind of ["CORRECT", "WRONG", "STEAL"]) {
      await open(page.request, id); if (kind === "STEAL") await command(page.request, id, { type: "WRONG" });
      const before = await current(page.request, id);
      await command(page.request, id, { type: kind === "WRONG" ? "WRONG" : "CORRECT" });
      await command(page.request, id, { type: "UNDO" }); const restored = await current(page.request, id);
      expect(restored.cells).toEqual(before.cells); expect(restored.teams).toEqual(before.teams); expect(restored.active).toEqual(before.active);
      await assertTV(tv, page.request, id, token); await tv.reload(); await assertTV(tv, page.request, id, token);
      await command(page.request, id, { type: "SKIP" });
    }
    await capture(tv, "TV-Undo-restored");
  } finally { await context.close(); }
});

test("L01 completed winning judgment Undo reaches connected TV and recovers during offline reconnect", async ({ page, browser }) => {
  await auth(page.context()); const id = fixture.tv.id, token = fixture.tv.token;
  let v = await current(page.request, id);
  for (const cell of v.cells.filter(c => !c.completed).slice(0, -1)) { await command(page.request, id, { type: "OPEN", categoryId: cell.categoryId, value: cell.value }); await command(page.request, id, { type: "SKIP" }); }
  await open(page.request, id);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } }), tv = await context.newPage();
  try {
    await tv.goto(`/display/${id}?token=${token}`); const before = await current(page.request, id);
    await command(page.request, id, { type: "CORRECT" }); await expect(tv.locator(".display-victory")).toBeVisible();
    await command(page.request, id, { type: "UNDO" }); await assertTV(tv, page.request, id, token);
    expect((await current(page.request, id)).active).toEqual(before.active);
    await command(page.request, id, { type: "CORRECT" }); await expect(tv.locator(".display-victory")).toBeVisible();
    await context.setOffline(true); await command(page.request, id, { type: "UNDO" }); await context.setOffline(false);
    await assertTV(tv, page.request, id, token); await tv.reload(); await assertTV(tv, page.request, id, token);
    v = await current(page.request, id); expect(v.status).toBe("IN_PROGRESS"); expect(v.endedAt).toBeNull();
    await capture(tv, "TV-winning-Undo-reconnect");
  } finally { await context.close(); }
});

test("L01 existing TV stays live beyond thirty seconds without fallback polling", async ({ page, browser }) => {
  await auth(page.context()); const id = fixture.tv.id;
  const context = await browser.newContext(), tv = await context.newPage(); let streams = 0, polls = 0;
  tv.on("request", r => { const path = new URL(r.url()).pathname; if (path === `/api/display/${id}/events`) streams++; if (path === `/api/display/${id}`) polls++; });
  try {
    await tv.goto(`/display/${id}?token=${fixture.tv.token}`); await expect(tv.locator(".display-question h1")).toBeVisible();
    await tv.waitForTimeout(32_000); await command(page.request, id, { type: "REVEAL" });
    await expect(tv.locator(".display-answer")).toBeVisible(); expect(streams).toBe(1); expect(polls).toBeLessThanOrEqual(1);
    await expect(tv.getByText("جارٍ إعادة الاتصال بشاشة العرض…")).toHaveCount(0);
  } finally { await context.close(); }
});

test("L02 API issuance respects three links, revoke invalidates old credentials, current reconnect works", async ({ page, browser }) => {
  await auth(page.context()); const id = fixture.tv.id;
  const mints = await Promise.all(Array.from({ length: 3 }, () => page.request.post(`/api/games/category-board/${id}/display-access`, { headers: { Origin: origin } })));
  expect(mints.map(r => r.status()).sort()).toEqual([200, 200, 429]); // Native fixture already has one valid link.
  expect((await page.request.delete(`/api/games/category-board/${id}/display-access`, { headers: { Origin: origin } })).status()).toBe(200);
  const context = await browser.newContext();
  try {
    expect((await context.request.get(`/api/display/${id}?token=${fixture.tv.token}`)).status()).toBe(403);
    const r = await page.request.post(`/api/games/category-board/${id}/display-access`, { headers: { Origin: origin } }); expect(r.status()).toBe(200);
    const link = await r.json(), token = new URL(link.url, origin).searchParams.get("token")!;
    expect((await context.request.get(`/api/display/${fixture.phone.id}?token=${token}`)).status()).toBe(403);
    const tv = await context.newPage(); await tv.goto(link.url); await expect(tv.locator(".display-question h1")).toBeVisible(); await tv.reload(); await expect(tv.locator(".display-question h1")).toBeVisible();
    expect((await context.request.post(`/api/games/category-board/${id}/commands`, { headers: { Origin: origin }, data: { key: randomUUID(), expectedVersion: 0, action: { type: "CORRECT" } } })).status()).toBe(403);
  } finally { await context.close(); }
});

test("L06 phone countdown pause/resume refresh reconnect and Undo use persisted server deadline", async ({ page, browser }) => {
  await auth(page.context()); const id = fixture.phone.id, code = fixture.phone.code;
  await open(page.request, id); await command(page.request, id, { type: "TIMER_START" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{ name: `qalba_room_${code}`, value: fixture.phone.phoneToken, url: origin, httpOnly: true }]);
  // A reasonable local phone clock offset must be compensated by existing serverNow synchronization.
  await context.addInitScript(() => { const now = Date.now.bind(Date); Date.now = () => now() + 120_000; });
  const phone = await context.newPage();
  try {
    await phone.goto(`/rooms/${code}`); const timer = phone.getByLabel("الوقت المتبقي"); await expect(timer).toBeVisible();
    const ms = () => timer.getAttribute("data-ms").then(x => Number(x));
    await expect.poll(ms).toBeGreaterThan(50_000); const first = await ms(); await phone.waitForTimeout(650); expect(await ms()).toBeLessThan(first);
    await command(page.request, id, { type: "PAUSE_GAME" }); await expect(timer).toContainText("متوقفة"); const paused = await ms(); await phone.waitForTimeout(700); expect(await ms()).toBe(paused);
    await phone.reload(); await expect.poll(ms).toBe(paused); await command(page.request, id, { type: "RESUME_GAME" }); await expect(timer).not.toContainText("متوقفة");
    const deadline = (await current(page.request, id)).active!.deadlineAt;
    await context.setOffline(true); await phone.waitForTimeout(700); await context.setOffline(false); await phone.reload();
    expect((await current(page.request, id)).active!.deadlineAt).toBe(deadline); await expect.poll(ms).toBeLessThan(paused);
    await phone.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); expect(await ms()).toBeGreaterThan(0);
    const r = await context.request.post(`/api/rooms/${code}/responses`, { headers: { Origin: origin }, data: { response: "مشاركة صحيحة أثناء الوقت", vote: false } }); expect(r.status()).toBe(200);
    await command(page.request, id, { type: "WRONG" }); const steal = await current(page.request, id); expect(steal.active!.phase).toBe("STEAL");
    await command(page.request, id, { type: "UNDO" }); const undoDeadline = (await current(page.request, id)).active!.deadlineAt; await phone.reload(); expect((await current(page.request, id)).active!.deadlineAt).toBe(undoDeadline); await expect(timer).toBeVisible();
    await capture(phone, "Phone-authoritative-timer"); await page.goto(`/play/${id}`); await capture(page, "Host-authoritative-timer");
  } finally { await context.close(); }
});

test("L06 expiry while phone request waits for native session lock rejects answer/vote with zero side effects", async ({ page, browser }) => {
  await auth(page.context()); const id = fixture.phone.id, code = fixture.phone.code;
  await command(page.request, id, { type: "SKIP" }); await open(page.request, id); await command(page.request, id, { type: "TIMER_START" });
  // Real PG gate, synthetic shortened existing deadline; production timer constants unchanged.
  await pool.query('UPDATE "GameSession" SET state=jsonb_set(state,\'{active,deadlineAt}\',to_jsonb($2::text)) WHERE id=$1', [id, new Date(Date.now() + 800).toISOString()]);
  const before = (await pool.query('SELECT "stateVersion",state FROM "GameSession" WHERE id=$1', [id])).rows[0];
  const counts = async () => (await pool.query('SELECT (SELECT count(*)::int FROM "PlayerResponse" p JOIN "GameRound" r ON r.id=p."roundId" WHERE r."sessionId"=$1) responses,(SELECT count(*)::int FROM "RoomVote" p JOIN "GameRound" r ON r.id=p."roundId" WHERE r."sessionId"=$1) votes,(SELECT count(*)::int FROM "GameCommand" WHERE "sessionId"=$1) commands,(SELECT version FROM "Room" WHERE "sessionId"=$1) room', [id])).rows[0];
  const saved = await counts(), gate = await pool.connect(); await gate.query("BEGIN"); await gate.query('SELECT id FROM "GameSession" WHERE id=$1 FOR UPDATE', [id]);
  const context = await browser.newContext(); await context.addCookies([{ name: `qalba_room_${code}`, value: fixture.phone.phoneToken, url: origin, httpOnly: true }]);
  try {
    const pending = context.request.post(`/api/rooms/${code}/responses`, { headers: { Origin: origin }, data: { response: "طلب متأخر", vote: false } });
    await expect.poll(async () => (await pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%GameSession%'")).rows[0].n).toBeGreaterThan(0);
    await page.waitForTimeout(950); await gate.query("COMMIT"); expect((await pending).status()).toBe(409);
    expect(await counts()).toEqual(saved); expect((await pool.query('SELECT "stateVersion",state FROM "GameSession" WHERE id=$1', [id])).rows[0]).toEqual(before);
    const phone = await context.newPage(); await phone.goto(`/rooms/${code}`); await expect(phone.getByLabel("الوقت المتبقي")).toHaveAttribute("data-ms", "0"); await expect(phone.getByLabel("إجابتك للمضيف")).toBeDisabled(); await phone.reload(); await expect(phone.getByLabel("الوقت المتبقي")).toHaveAttribute("data-ms", "0");
    // Valid options were authored in the isolated fixture bank BEFORE this round was snapshotted.
    const choices = (await current(page.request, id)).active!.options!; expect(choices.length).toBeGreaterThan(1);
    expect((await context.request.post(`/api/rooms/${code}/responses`, { headers: { Origin: origin }, data: { response: choices[0], vote: true } })).status()).toBe(409); expect(await counts()).toEqual(saved);
    await capture(phone, "Phone-expired-reconnect");
  } finally { await gate.query("ROLLBACK"); gate.release(); await context.close(); }
});

test("L04 durable metrics and latest profile authorities render without private leakage", async ({ page, browser }) => {
  await auth(page.context()); await page.goto("/profile");
  await expect(page.getByText("آخر حالة لكل جلسة؛ إعادة المباراة داخل الجلسة لا تنشئ بطاقة جديدة.")).toBeVisible();
  const letter = fixture.fixtures.find(f => f.game === "letter")!;
  await expect(page.locator("article").filter({ has: page.locator(`a[href='/letter-network/host/${letter.id}']`) })).toContainText("1 خلية");
  const routes: Record<string, string> = { board: "/play/", social: "/social/host/", letter: "/letter-network/host/", survey: "/survey-show/host/", forbidden: "/secret-word/host/", bluff: "/bluff/host/", ranked: "/ranked/host/", lightning: "/lightning/host/", ordering: "/ordering/host/", court: "/court/host/" };
  for (const f of fixture.fixtures) await expect(page.locator(`a[href='${routes[f.game]}${f.id}']`)).toHaveCount(1);
  await capture(page, "Profile-latest-history");
  const refunded = await browser.newContext(); try { await auth(refunded, fixture.refundToken); const p = await refunded.newPage(); await p.goto("/profile"); await expect(p.getByText(/PAID · استرداد مؤكد/)).toBeVisible(); } finally { await refunded.close(); }
  const context = await browser.newContext();
  try { await auth(context, fixture.adminToken); const admin = await context.newPage(); await admin.goto("/admin");
    await expect(admin.getByText("جلسات منشأة", { exact: true })).toBeVisible(); await expect(admin.getByText("إجمالي المبيعات المسوّاة قبل الاسترداد", { exact: true })).toBeVisible(); await expect(admin.getByText(/الاستردادات المؤكدة:/)).toBeVisible();
    await admin.goto("/admin/analytics"); await expect(admin.getByRole("heading", { name: "كل الجلسات المنشأة" })).toBeVisible(); await expect(admin.getByRole("heading", { name: "اختيارات محتوى محفوظة" })).toBeVisible(); await expect(admin.getByText(/COURT_GAME_ABANDONED:/)).toBeVisible(); await capture(admin, "Admin-explicit-metrics");
  } finally { await context.close(); }
});
