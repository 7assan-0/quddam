import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test, request, type APIRequestContext, type Page } from "@playwright/test";
import { fixtureSql as sql, gameplayFootprint, socialRound } from "./helpers/content-eligibility-fixture";

const origin = "http://127.0.0.1:3000", headers = { Origin: origin };
async function register(page: Page) {
  const email = `e1-${randomUUID()}@example.test`, password = "retention-browser-password";
  const r = await page.request.post("/api/auth/register", { headers, data: { name: "مضيف دورة البيانات", email, password } }); expect(r.status(), await r.text()).toBe(201); return { email, password };
}
async function read(api: APIRequestContext, game: string, id: string) { const r = await api.get(`/api/${game}/${id}`); expect(r.status(), await r.text()).toBe(200); return r.json(); }
async function command(api: APIRequestContext, game: string, id: string, action: Record<string, unknown>, participant?: APIRequestContext) {
  const v = await read(api, game, id); const r = await (participant ?? api).post(`/api/${game}/${id}/commands`, { headers, data: { key: randomUUID(), expectedVersion: v.version, action: action.type === "SUBMIT_VOTE" ? { ...action, roundId: v.roundId, ballot: v.ballot } : action } }); expect(r.status(), await r.text()).toBe(200); return r.json();
}
async function create(api: APIRequestContext, game: string) { const r = await api.post(`/api/${game}`, { headers, data: game === "social" ? { timerSeconds: 60 } : game === "court" ? { teams: ["فريق المرجان", "فريق البحر"] } : { names: ["فريق المرجان", "فريق البحر"] } }); expect(r.status(), await r.text()).toBe(201); return r.json(); }
function cleanup(dryRun = false, batch = 100) {
  expect(process.env.E2E_DATABASE_URL?.includes("127.0.0.1")).toBeTruthy();
  return JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "scripts/data-retention.ts", `--batch-size=${batch}`, ...(dryRun ? ["--dry-run"] : [])], { env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL }, encoding: "utf8", timeout: 30_000 }));
}
const stable = (v: Record<string, unknown>) => Object.fromEntries(Object.entries(v).filter(([key]) => key !== "serverNow"));
async function age(id: string, votes?: "SocialVote" | "CourtRoundVote") {
  await sql('UPDATE "GameSession" SET "endedAt"=(now() AT TIME ZONE \'UTC\')-interval \'120 days\' WHERE id=$1', [id]);
  await sql('UPDATE "Room" SET "expiresAt"=(now() AT TIME ZONE \'UTC\')-interval \'120 days\' WHERE "sessionId"=$1', [id]);
  if (votes) await sql(`UPDATE "${votes}" SET "createdAt"=(now() AT TIME ZONE 'UTC')-interval '120 days' WHERE "roundId" IN (SELECT id FROM "${votes === "SocialVote" ? "SocialRound" : "CourtRound"}" WHERE "sessionId"=$1)`, [id]);
}
async function profile(page: Page, id: string, prefix: string, container: string) {
  await page.goto("/profile"); const link = page.locator(`.history-row a[href="${prefix}/${id}"]`); await expect(link).toBeVisible(); await link.click(); await expect(page).toHaveURL(origin + prefix + "/" + id); await expect(page.locator(container)).toBeVisible();
}

test("E1 01 Social active privacy, dry-run, private cleanup, raw Cookie denial and historical result", async ({ page }, info) => {
  test.setTimeout(120_000); await register(page); const room = await create(page.request, "social"), clients: { api: APIRequestContext; id: string; cookie: string }[] = [];
  try {
    for (let i = 0; i < 3; i++) { const api = await request.newContext({ baseURL: origin }); const r = await api.post(`/api/social/${room.id}/join`, { headers, data: { code: room.code, name: `لاعب احتفاظ ${i}` } }); expect(r.status()).toBe(201); const v = await (await api.get(`/api/social/${room.id}/player`)).json(); const cookie = (await api.storageState()).cookies.find(c => c.name === `qalba_social_${room.id}`)!; clients.push({ api, id: v.self.id, cookie: `${cookie.name}=${cookie.value}` }); }
    await command(page.request, "social", room.id, { type: "START" }); const round = await socialRound(room.id), activeBefore = await gameplayFootprint(room.id); cleanup(); expect(await gameplayFootprint(room.id)).toEqual(activeBefore);
    for (const c of clients) { const v = await (await c.api.get(`/api/social/${room.id}/player`)).json(); expect(v.self.secretWord).toBe(c.id === round.outsiderId ? null : round.wordSnapshot); }
    await command(page.request, "social", room.id, { type: "BEGIN_DISCUSSION" }); await command(page.request, "social", room.id, { type: "BEGIN_VOTING" });
    for (const c of clients) await command(page.request, "social", room.id, { type: "SUBMIT_VOTE", targetId: c.id === round.outsiderId ? clients.find(p => p.id !== c.id)!.id : round.outsiderId }, c.api);
    await command(page.request, "social", room.id, { type: "SUBMIT_GUESS", guess: round.wordSnapshot }, clients.find(c => c.id === round.outsiderId)!.api); await command(page.request, "social", room.id, { type: "COMPLETE" }); await age(room.id, "SocialVote");
    const before = stable(await read(page.request, "social", room.id)), data = await gameplayFootprint(room.id), preview = cleanup(true);
    expect(preview.eligible).toBeGreaterThanOrEqual(6); expect(preview.deleted + preview.redacted).toBe(0); expect(await gameplayFootprint(room.id)).toEqual(data);
    const first = cleanup(false, 1); expect(first.deleted + first.redacted).toBe(1); expect(stable(await read(page.request, "social", room.id))).toEqual(before);
    const result = cleanup(); expect(result.failed).toBe(0); expect((await sql('SELECT COUNT(*)::int AS n FROM "SocialVote" v JOIN "SocialRound" r ON r.id=v."roundId" WHERE r."sessionId"=$1', [room.id]))[0].n).toBe(0);
    expect(stable(await read(page.request, "social", room.id))).toEqual(before); expect(cleanup().deleted + cleanup().redacted).toBe(0);
    const raw = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Cookie: clients[0].cookie } });
    try { const current = await read(page.request, "social", room.id), protectedBefore = await gameplayFootprint(room.id); const r = await raw.post(`/api/social/${room.id}/commands`, { headers, data: { key: randomUUID(), expectedVersion: current.version, action: { type: "FINISH_TURN" } } }); expect(r.status(), await r.text()).toBe(403); expect(await gameplayFootprint(room.id)).toEqual(protectedBefore); } finally { await raw.dispose(); }
    await profile(page, room.id, "/social/host", ".social-page"); await expect(page.locator(".social-result h2")).toContainText("فاز"); await page.screenshot({ path: info.outputPath("social-history-after-cleanup.png"), fullPage: true });
    await info.attach("retention-social-aggregate", { body: JSON.stringify({ preview, first, result, historyUnchanged: true, rawCookieRejected: true }), contentType: "application/json" });
  } finally { for (const c of clients) await c.api.dispose(); }
});

test("E1 02 Court active jury privacy and historical verdict remain after individual-vote removal", async ({ page }, info) => {
  test.setTimeout(120_000); await register(page); const room = await create(page.request, "court"), clients: APIRequestContext[] = [];
  try {
    for (let i = 0; i < 4; i++) { const api = await request.newContext({ baseURL: origin }); const r = await api.post(`/api/court/${room.id}/join`, { headers, data: { code: room.code, name: `محلف احتفاظ ${i}` } }); expect(r.status(), await r.text()).toBe(200); clients.push(api); }
    for (const type of ["START", "START_ROUND", "START_PREPARATION", ...Array<string>(5).fill("ADVANCE_PHASE")]) await command(page.request, "court", room.id, { type });
    const vote = async (i: number) => { const r = await clients[i].post(`/api/court/${room.id}/juror`, { headers, data: { key: randomUUID(), matchNumber: 1, roundNumber: 1, choice: i === 3 ? "DEFENSE" : "PROSECUTION" } }); expect(r.status(), await r.text()).toBe(200); };
    await vote(0); const beforeActive = await read(page.request, "court", room.id); expect(beforeActive.verdict).toBeNull(); expect(JSON.stringify(beforeActive)).not.toMatch(/prosecutionVotes|defenseVotes|"choice"/);
    const beforeRows = await sql('SELECT v.* FROM "CourtRoundVote" v JOIN "CourtRound" r ON r.id=v."roundId" WHERE r."sessionId"=$1', [room.id]); cleanup(); expect(await sql('SELECT v.* FROM "CourtRoundVote" v JOIN "CourtRound" r ON r.id=v."roundId" WHERE r."sessionId"=$1', [room.id])).toEqual(beforeRows);
    for (let i = 1; i < 4; i++) await vote(i); await command(page.request, "court", room.id, { type: "END_GAME" }); await command(page.request, "court", room.id, { type: "COMPLETE" }); await age(room.id, "CourtRoundVote");
    const before = stable(await read(page.request, "court", room.id)), result = cleanup(); expect(result.failed).toBe(0); expect(result.deleted).toBeGreaterThanOrEqual(4); expect(result.redacted).toBeGreaterThanOrEqual(4); expect(stable(await read(page.request, "court", room.id))).toEqual(before);
    expect((await sql('SELECT COUNT(*)::int AS n FROM "CourtRoundVote" v JOIN "CourtRound" r ON r.id=v."roundId" WHERE r."sessionId"=$1', [room.id]))[0].n).toBe(0); await profile(page, room.id, "/court/host", ".court-host"); await page.screenshot({ path: info.outputPath("court-history-after-cleanup.png"), fullPage: true });
    await info.attach("retention-court-aggregate", { body: JSON.stringify({ result, historicalVoteCount: before.voteCount, verdictAndScoresUnchanged: true }), contentType: "application/json" });
  } finally { for (const api of clients) await api.dispose(); }
});

test("E1 03 old Category Board, Letter and Survey result routes/snapshots survive cleanup", async ({ page }, info) => {
  test.setTimeout(180_000); await register(page);
  const categoryIds = (await sql('SELECT c.id FROM "Category" c JOIN "Question" q ON q."categoryId"=c.id JOIN "GameType" g ON g.id=q."gameTypeId" WHERE c.active AND g.slug=\'category-board\' AND q.status=\'PUBLISHED\' AND q."pointValue" IN (200,400,600) GROUP BY c.id HAVING COUNT(DISTINCT q."pointValue")=3 ORDER BY c.id LIMIT 6')).map(c => c.id);
  const made = await page.request.post("/api/games/category-board", { headers, data: { categoryIds, teamNames: ["فريق التاريخ", "فريق اللوحة"], timerSeconds: 30 } }); expect(made.status(), await made.text()).toBe(201); const b = await made.json();
  await command(page.request, "games/category-board", b.id, { type: "START" }); await command(page.request, "games/category-board", b.id, { type: "END_GAME" }); await age(b.id);
  const l = await create(page.request, "letter-network"); await command(page.request, "letter-network", l.id, { type: "START" }); const lv = await read(page.request, "letter-network", l.id);
  await command(page.request, "letter-network", l.id, { type: "SELECT_CELL", cellId: lv.board[0].cellId }); for (const type of ["OPEN_QUESTION", "REVEAL_ANSWER", "CORRECT", "END_GAME", "COMPLETE"]) await command(page.request, "letter-network", l.id, { type }); await age(l.id);
  const s = await create(page.request, "survey-show"); await command(page.request, "survey-show", s.id, { type: "START" }); await command(page.request, "survey-show", s.id, { type: "ABANDON" }); await age(s.id);
  const pairs = [["games/category-board", b.id], ["letter-network", l.id], ["survey-show", s.id]]; const before = await Promise.all(pairs.map(async ([game, id]) => stable(await read(page.request, game, id)))); const result = cleanup(); expect(result.failed).toBe(0);
  expect(await Promise.all(pairs.map(async ([game, id]) => stable(await read(page.request, game, id))))).toEqual(before);
  for (const [id, prefix, selector, phase] of [[b.id, "/play", ".host-game .victory", ""], [l.id, "/letter-network/host", ".letter-page", "COMPLETED"], [s.id, "/survey-show/host", ".survey-host", "ABANDONED"]]) { await page.goto("/profile"); const link = page.locator(`.history-row a[href="${prefix}/${id}"]`); await expect(link).toBeVisible(); await link.click(); await expect(page).toHaveURL(origin + prefix + "/" + id); await expect(page.locator(selector)).toBeVisible(); if (phase) await expect(page.locator(selector)).toHaveAttribute("data-phase", phase); expect(await page.locator("body").innerText()).not.toContain("المباراة غير موجودة"); await page.screenshot({ path: info.outputPath(`${id}-result-after-cleanup.png`), fullPage: true }); }
  await page.goto("/profile"); await expect(page.locator(".history-row")).toHaveCount(3); await page.screenshot({ path: info.outputPath("board-letter-survey-history-after-cleanup.png"), fullPage: true });
  await info.attach("retention-history-aggregate", { body: JSON.stringify({ result, routesVerified: 3, snapshotAndResultEquality: true }), contentType: "application/json" });
});

test("E1 04 deleting an eligible revoked AuthSession stops its already-open Host SSE; fresh login stays valid", async ({ page }, info) => {
  test.setTimeout(120_000); const login = await register(page), room = await create(page.request, "letter-network");
  await command(page.request, "letter-network", room.id, { type: "START" }); const v = await read(page.request, "letter-network", room.id);
  await command(page.request, "letter-network", room.id, { type: "SELECT_CELL", cellId: v.board[0].cellId }); for (const type of ["OPEN_QUESTION", "REVEAL_ANSWER", "PAUSE"]) await command(page.request, "letter-network", room.id, { type });
  const cookie = (await page.context().cookies()).find(c => c.name === "qalba_session")!, hash = createHash("sha256").update(cookie.value).digest("hex"); const original = (await sql('SELECT id FROM "AuthSession" WHERE "tokenHash"=$1', [hash]))[0].id;
  await page.goto("/games");
  await page.evaluate(id => { const w = window as unknown as { retentionProbe: { states: number; ended: boolean; raw: string } }; const p: { states: number; ended: boolean; raw: string } = w.retentionProbe = { states: 0, ended: false, raw: "" };
    void (async () => { try { const r = await fetch(`/api/letter-network/${id}/events?audience=host`), reader = r.body!.getReader(), decoder = new TextDecoder(); for (;;) { const chunk = await reader.read(); if (chunk.done) break; const text = decoder.decode(chunk.value, { stream: true }); p.raw += text; p.states = (p.raw.match(/event: state\n/g) ?? []).length; } } finally { p.ended = true; } })();
  }, room.id);
  const probe = () => page.evaluate(() => (window as unknown as { retentionProbe: { states: number; ended: boolean; raw: string } }).retentionProbe);
  await expect.poll(async () => (await probe()).states).toBe(1); expect((await probe()).raw).toContain('"answer"');
  await sql('UPDATE "AuthSession" SET "revokedAt"=(now() AT TIME ZONE \'UTC\')-interval \'31 days\' WHERE id=$1', [original]); const result = cleanup(); expect(result.deleted).toBeGreaterThanOrEqual(1); expect(await sql('SELECT id FROM "AuthSession" WHERE id=$1', [original])).toEqual([]);
  await expect.poll(async () => (await probe()).ended, { timeout: 30_000 }).toBe(true); expect((await probe()).raw).toContain("access-ended"); const count = (await probe()).states;
  expect((await page.request.get(`/api/letter-network/${room.id}`)).status()).toBe(403);
  const fresh = await page.request.post("/api/auth/login", { headers, data: login }); expect(fresh.status(), await fresh.text()).toBe(200); expect((await read(page.request, "letter-network", room.id)).question.answer).toBeTruthy();
  expect((await probe()).states).toBe(count); await info.attach("retention-H01-aggregate", { body: JSON.stringify({ result, originalSessionDeleted: true, originalStreamEnded: true, additionalPrivateStatesAfterEnd: 0, freshLoginAuthorized: true }), contentType: "application/json" });
});
