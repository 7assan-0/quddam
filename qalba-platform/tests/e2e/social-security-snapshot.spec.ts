import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, request, type APIRequestContext, type Page } from "@playwright/test";
const origin = "http://127.0.0.1:3000";
async function sql(text: string, values: unknown[] = []) { const p = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 1 }); try { return await p.query(text, values); } finally { await p.end(); } }
type Client = { api: APIRequestContext; cookie: string; id: string };
async function setup(page: Page, registerHost = true) {
  expect(process.env.E2E_DATABASE_URL).toBeTruthy();
  if (registerHost) { const register = await page.request.post("/api/auth/register", { headers: { Origin: origin }, data: { name: "مضيف أمان", email: `social-security-${randomUUID()}@example.test`, password: "social-security-password" } }); expect(register.status()).toBe(201); }
  const created = await page.request.post("/api/social", { headers: { Origin: origin }, data: { timerSeconds: 60 } }); expect(created.status()).toBe(201);
  const room = await created.json(); const clients: Client[] = [];
  for (let i = 0; i < 3; i++) {
    const api = await request.newContext({ baseURL: origin });
    const joined = await api.post(`/api/social/${room.id}/join`, { headers: { Origin: origin }, data: { code: room.code, name: `مشارك ${i}` } }); expect(joined.status(), await joined.text()).toBe(201);
    const state = await api.storageState(); const cookie = state.cookies.find(c => c.name === `qalba_social_${room.id}`)!;
    const view = await (await api.get(`/api/social/${room.id}/player`)).json(); clients.push({ api, cookie: `${cookie.name}=${cookie.value}`, id: view.self.id });
  }
  return { id: room.id as string, clients };
}
async function view(page: Page, id: string) { return (await page.request.get(`/api/social/${id}`)).json(); }
async function command(page: Page, id: string, action: Record<string, unknown>, cookie?: string, key = randomUUID()) {
  const current = await view(page, id);
  // Explicit raw Cookie sends the original credential even after browser cookie expiry.
  const api = cookie ? await request.newContext({ baseURL: origin, extraHTTPHeaders: { Cookie: cookie } }) : page.request;
  try { const r = await api.post(`/api/social/${id}/commands`, { headers: { Origin: origin }, data: { key, expectedVersion: current.version, action: action.type === "SUBMIT_VOTE" ? { ...action, roundId: current.roundId, ballot: current.ballot } : action } });
    const status = r.status(), body = await r.text(); return { status: () => status, text: async () => body, json: async () => JSON.parse(body) }; }
  finally { if (cookie) await api.dispose(); }
}
async function host(page: Page, id: string, type: string) { const r = await command(page, id, { type }); expect(r.status(), await r.text()).toBe(200); }
async function invariant(id: string) {
  const game = (await sql('SELECT row_to_json(g) AS data FROM "GameSession" g WHERE "id"=$1', [id])).rows[0].data;
  const tables = ['GameCommand','SocialParticipant','SocialRound','ScoreEvent'];
  const rows: Record<string, unknown> = { game };
  for (const table of tables) rows[table] = (await sql(`SELECT row_to_json(t) AS data FROM "${table}" t WHERE "sessionId"=$1 ORDER BY "id"`, [id])).rows;
  rows.votes = (await sql('SELECT row_to_json(v) AS data FROM "SocialVote" v JOIN "SocialRound" r ON r."id"=v."roundId" WHERE r."sessionId"=$1 ORDER BY v."id"', [id])).rows;
  return rows;
}
async function toGuess(page: Page, id: string, clients: Client[]) {
  await host(page, id, "BEGIN_DISCUSSION"); await host(page, id, "BEGIN_VOTING");
  const outsiderId = (await sql('SELECT "outsiderId" FROM "SocialRound" WHERE "sessionId"=$1 ORDER BY "number" DESC LIMIT 1', [id])).rows[0].outsiderId;
  for (const c of clients) { const targetId = c.id === outsiderId ? clients.find(p => p.id !== outsiderId)!.id : outsiderId; const r = await command(page, id, { type: "SUBMIT_VOTE", targetId }, c.cookie); expect(r.status(), await r.text()).toBe(200); }
  expect((await view(page, id)).phase).toBe("OUTSIDER_GUESS"); return clients.find(c => c.id === outsiderId)!;
}
for (const type of ["FINISH_TURN", "SUBMIT_VOTE", "SUBMIT_GUESS"]) {
  test(`H02: expired raw Cookie cannot ${type}; duplicate key leaves zero mutations`, async ({ page }, info) => {
    const { id, clients } = await setup(page);
    try {
      await host(page, id, "START"); let c = clients[0];
      if (type === "FINISH_TURN") await host(page, id, "BEGIN_DISCUSSION");
      if (type === "SUBMIT_VOTE") { await host(page, id, "BEGIN_DISCUSSION"); await host(page, id, "BEGIN_VOTING"); }
      if (type === "SUBMIT_GUESS") c = await toGuess(page, id, clients);
      await sql('UPDATE "Room" SET "expiresAt"=(now() AT TIME ZONE \'UTC\')-interval \'1 second\' WHERE "sessionId"=$1', [id]);
      const before = await invariant(id), key = randomUUID(); const action = type === "SUBMIT_VOTE" ? { type, targetId: clients[1].id } : type === "SUBMIT_GUESS" ? { type, guess: "تخمين" } : { type };
      for (let n = 0; n < 2; n++) { const rejected = await command(page, id, action, c.cookie, key); expect(rejected.status()).toBe(403); expect((await rejected.json()).code).toBe("PLAYER_ACCESS_DENIED"); }
      const after = await invariant(id); expect(after).toEqual(before);
      await info.attach("H02-zero-mutation", { body: JSON.stringify({ action: type, before, after, equal: true, repeatedKeyRejected: true }), contentType: "application/json" });
    } finally { for (const c of clients) await c.api.dispose(); }
  });
}
test("H02: expired cross-room credential racing valid participant cannot interfere", async ({ page }, info) => {
  const expired = await setup(page); const valid = await setup(page, false);
  try {
    await host(page, valid.id, "START"); await host(page, valid.id, "BEGIN_DISCUSSION");
    await sql('UPDATE "Room" SET "expiresAt"=(now() AT TIME ZONE \'UTC\')-interval \'1 second\' WHERE "sessionId"=$1', [expired.id]);
    const before = await invariant(expired.id), v = (await view(page, valid.id)).version;
    const responses = await Promise.all([command(page, expired.id, { type: "FINISH_TURN" }, expired.clients[0].cookie), command(page, valid.id, { type: "FINISH_TURN" }, valid.clients[0].cookie)]);
    expect(responses.map(r => r.status())).toEqual([403, 200]); expect(await invariant(expired.id)).toEqual(before); expect((await view(page, valid.id)).version).toBe(v + 1);
    const foreign = await command(page, valid.id, { type: "FINISH_TURN" }, `qalba_social_${valid.id}=${expired.clients[0].cookie.split("=")[1]}`); expect(foreign.status()).toBe(403);
    await info.attach("H02-isolation", { body: JSON.stringify({ expiredStatus: 403, validStatus: 200, validVersionDelta: 1, crossSessionRejected: true }), contentType: "application/json" });
  } finally { for (const c of [...expired.clients, ...valid.clients]) await c.api.dispose(); }
});
async function streamState(page: Page, url: string) {
  return page.evaluate(async url => {
    const abort = new AbortController();
    try {
      const response = await fetch(url, { signal: abort.signal }); if (!response.ok) throw new Error(`SSE status ${response.status}`);
      const reader = response.body!.getReader(), decoder = new TextDecoder(); let text = "";
      while (!text.includes("\n\n")) { const next = await reader.read(); if (next.done) throw new Error("SSE ended without state"); text += decoder.decode(next.value, { stream: true }); }
      return JSON.parse(text.split("data: ")[1].split("\n\n")[0]);
    } finally { abort.abort(); }
  }, url);
}
for (const accepted of [true, false]) {
  test(`H03: admin edits do not change snapshot; ${accepted ? "original alias accepted" : "new alias rejected"}; rematch uses new bank`, async ({ page, browser }, info) => {
    test.setTimeout(120000); const { id, clients } = await setup(page); const admin = await request.newContext({ baseURL: origin });
    const bank = (await sql('SELECT "id","status" FROM "SecretWord"')).rows;
    let wordId = "";
    try {
      const login = await admin.post("/api/auth/login", { headers: { Origin: origin }, data: { email: "admin@example.test", password: "e2e-admin-password-123" } }); expect(login.status()).toBe(200);
      const categoryId = (await sql('SELECT "id" FROM "Category" LIMIT 1')).rows[0].id;
      await sql('UPDATE "SecretWord" SET "status"=\'ARCHIVED\''); // isolate disposable selection fixture
      const oldWord = `مرجان ${randomUUID().slice(0, 8)}`, oldAlias = "بديل أصلي ثابت", newWord = "كلمة البنك الجديدة", newAlias = "بديل البنك الجديد";
      const input = { word: oldWord, alternativeAnswers: [oldAlias], categoryId, difficulty: "EASY", status: "PUBLISHED" };
      const created = await admin.post("/api/admin/secret-words", { headers: { Origin: origin }, data: input }); expect(created.status(), await created.text()).toBe(201); wordId = (await created.json()).id;
      await host(page, id, "START");
      const original = (await sql('SELECT "wordSnapshot","alternativesSnapshot","snapshotOrigin" FROM "SocialRound" WHERE "sessionId"=$1', [id])).rows[0];
      expect(original).toEqual({ wordSnapshot: oldWord, alternativesSnapshot: [oldAlias], snapshotOrigin: "ROUND_CREATION" });
      const edited = await admin.patch(`/api/admin/secret-words/${wordId}`, { headers: { Origin: origin }, data: { ...input, word: newWord, alternativeAnswers: [newAlias] } }); expect(edited.status(), await edited.text()).toBe(200);
      let normal: Client | undefined;
      for (const c of clients) { const reconnect = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Cookie: c.cookie } }); try { const v = await (await reconnect.get(`/api/social/${id}/player`)).json(); if (v.self.role === "PLAYER") { normal = c; expect(v.self.secretWord).toBe(oldWord); } else { expect(v.self.secretWord).toBeNull(); expect(JSON.stringify(v)).not.toContain(oldWord); } expect(v).not.toHaveProperty("alternativesSnapshot"); } finally { await reconnect.dispose(); } }
      const ctx = await browser.newContext();
      try { await ctx.addCookies([{ name: `qalba_social_${id}`, value: normal!.cookie.split("=")[1], url: origin }]); const player = await ctx.newPage(); await player.goto(`/social/play/${id}`); await expect(player.getByText(oldWord, { exact: true })).toBeVisible(); await player.reload(); await expect(player.getByText(oldWord, { exact: true })).toBeVisible();
        const privateStream = await streamState(player, `/api/social/${id}/events?audience=player`); expect(privateStream.self.secretWord).toBe(oldWord); expect(JSON.stringify(privateStream)).not.toContain(oldAlias);
        // The role is checked from the authorized private view, never inferred by position.
        for (const c of clients) { const role = await (await c.api.get(`/api/social/${id}/player`)).json(); if (role.self.role !== "OUTSIDER") continue;
          const outsideCtx = await browser.newContext(); try { await outsideCtx.addCookies([{ name: `qalba_social_${id}`, value: c.cookie.split("=")[1], url: origin }]); const outsidePage = await outsideCtx.newPage(); const html = await outsidePage.goto(`/social/play/${id}`); expect(await html!.text()).not.toContain(oldWord); const state = await streamState(outsidePage, `/api/social/${id}/events?audience=player`); expect(state.self.secretWord).toBeNull(); expect(JSON.stringify(state)).not.toContain(oldWord); } finally { await outsideCtx.close(); }
        }
      }
      finally { await ctx.close(); }
      expect(JSON.stringify(await view(page, id))).not.toContain(oldWord);
      await page.goto("/games"); const hostStream = await streamState(page, `/api/social/${id}/events?audience=host`); expect(JSON.stringify(hostStream)).not.toContain(oldWord); expect(hostStream).not.toHaveProperty("wordSnapshot");
      const access = await page.request.post(`/api/social/${id}/display-access`, { headers: { Origin: origin } }); expect(access.status()).toBe(200); const link = await access.json(); const tv = await request.newContext({ baseURL: origin });
      try { const display = await tv.get(new URL(link.url, origin).pathname.replace('/social/display/', '/api/social/') + '/display' + new URL(link.url, origin).search); expect(display.status()).toBe(200); expect(JSON.stringify(await display.json())).not.toContain(oldWord); } finally { await tv.dispose(); }
      const tvStream = await streamState(page, `/api/social/${id}/events?audience=display&token=${new URL(link.url, origin).searchParams.get("token")}`); expect(JSON.stringify(tvStream)).not.toContain(oldWord);
      const outsider = await toGuess(page, id, clients);
      const guess = await command(page, id, { type: "SUBMIT_GUESS", guess: accepted ? oldAlias : newAlias }, outsider.cookie); expect(guess.status(), await guess.text()).toBe(200);
      const result = await view(page, id); expect(result.reveal.secretWord).toBe(oldWord); expect(result.reveal.winner).toBe(accepted ? "OUTSIDER" : "PLAYERS");
      await host(page, id, "COMPLETE"); expect((await view(page, id)).reveal.secretWord).toBe(oldWord);
      const historyBefore = (await sql('SELECT "wordSnapshot","alternativesSnapshot","winner","guess" FROM "SocialRound" WHERE "sessionId"=$1 AND "number"=1', [id])).rows[0];
      await host(page, id, "REMATCH");
      const future = (await sql('SELECT "wordSnapshot","alternativesSnapshot" FROM "SocialRound" WHERE "sessionId"=$1 AND "number"=2', [id])).rows[0]; expect(future).toEqual({ wordSnapshot: newWord, alternativesSnapshot: [newAlias] });
      expect((await sql('SELECT "wordSnapshot","alternativesSnapshot","winner","guess" FROM "SocialRound" WHERE "sessionId"=$1 AND "number"=1', [id])).rows[0]).toEqual(historyBefore);
      await info.attach("H03-snapshot", { body: JSON.stringify({ original, acceptedOriginalAlias: accepted, result: result.reveal, history: historyBefore, future, unchangedHistory: true }), contentType: "application/json" });
    } finally {
      if (wordId) await sql('UPDATE "SecretWord" SET "status"=\'ARCHIVED\' WHERE "id"=$1', [wordId]);
      for (const row of bank) await sql('UPDATE "SecretWord" SET "status"=$2::"QuestionStatus" WHERE "id"=$1', [row.id, row.status]);
      for (const c of clients) await c.api.dispose(); await admin.dispose();
    }
  });
}
