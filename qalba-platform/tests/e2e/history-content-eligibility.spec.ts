import { randomUUID } from "node:crypto";
import { expect, test, request, type APIRequestContext, type Page } from "@playwright/test";
import { contentBank, fixtureSql, socialRound, letterUses, surveyUses, gameplayFootprint, type ContentGame } from "./helpers/content-eligibility-fixture";
import { openExistingLegacyLobby } from "./helpers/legacy-fixture";

const origin = "http://127.0.0.1:3000";
const headers = { Origin: origin };
const names = ["فريق السجل", "فريق التحدي"];
async function login(api: APIRequestContext, admin = false) {
  const response = await api.post("/api/auth/login", { headers, data: { email: admin ? "admin@example.test" : "player@example.test", password: admin ? "e2e-admin-password-123" : "e2e-player-password-123" } });
  expect(response.status(), await response.text()).toBe(200);
}
async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", { headers, data: { name: "مضيف أهلية", email: `d3-${randomUUID()}@example.test`, password: "history-content-password" } });
  expect(response.status(), await response.text()).toBe(201);
}
async function create(api: APIRequestContext, game: ContentGame) {
  const response = await api.post(`/api/${game}`, { headers, data: game === "social" ? { timerSeconds: 60 } : { names } });
  expect(response.status(), await response.text()).toBe(201); return response.json();
}
async function read(api: APIRequestContext, game: ContentGame, id: string) {
  const response = await api.get(`/api/${game}/${id}`); expect(response.status(), await response.text()).toBe(200); return response.json();
}
async function send(api: APIRequestContext, game: ContentGame, id: string, action: Record<string, unknown>, participant?: APIRequestContext) {
  const view = await read(api, game, id);
  return (participant ?? api).post(`/api/${game}/${id}/commands`, { headers, data: { key: randomUUID(), expectedVersion: view.version, action: action.type === "SUBMIT_VOTE" ? { ...action, roundId: view.roundId, ballot: view.ballot } : action } });
}
async function command(api: APIRequestContext, game: ContentGame, id: string, action: Record<string, unknown>, participant?: APIRequestContext) {
  const response = await send(api, game, id, action, participant); expect(response.status(), await response.text()).toBe(200); return (await response.json()).session;
}
async function join(room: { id: string; code: string }) {
  const clients: { api: APIRequestContext; id: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const api = await request.newContext({ baseURL: origin });
    const response = await api.post(`/api/social/${room.id}/join`, { headers, data: { code: room.code, name: `مشارك أهلية ${i}` } });
    expect(response.status(), await response.text()).toBe(201);
    const view = await (await api.get(`/api/social/${room.id}/player`)).json(); clients.push({ api, id: view.self.id });
  }
  return clients;
}
async function finishSocial(api: APIRequestContext, id: string, clients: Awaited<ReturnType<typeof join>>, guess = "تخمين غير مطابق") {
  const round = await socialRound(id);
  await command(api, "social", id, { type: "BEGIN_DISCUSSION" }); await command(api, "social", id, { type: "BEGIN_VOTING" });
  for (const client of clients) await command(api, "social", id, { type: "SUBMIT_VOTE", targetId: client.id === round.outsiderId ? clients.find(c => c.id !== round.outsiderId)!.id : round.outsiderId }, client.api);
  await command(api, "social", id, { type: "SUBMIT_GUESS", guess }, clients.find(c => c.id === round.outsiderId)!.api);
  await command(api, "social", id, { type: "COMPLETE" });
}
async function historyClick(page: Page, id: string, prefix: string, completed = false) {
  await page.goto("/profile"); const link = page.locator(`.history-row a[href="${prefix}/${id}"]`);
  await expect(link).toBeVisible(); await expect(link).toHaveText(completed ? "عرض النتيجة" : "العودة للمباراة");
  await link.click(); await expect(page).toHaveURL(origin + prefix + "/" + id);
  await expect(page.locator(prefix.startsWith("/social") ? ".social-page" : ".letter-page")).toBeVisible();
}

test("D3 M10 01 Social profile lobby, active and completed links open the dedicated Host/result", async ({ page }, info) => {
  test.setTimeout(120_000); await login(page.request); const room = await create(page.request, "social"), clients = await join(room);
  try {
    await historyClick(page, room.id, "/social/host"); await command(page.request, "social", room.id, { type: "START" });
    await historyClick(page, room.id, "/social/host"); expect((await read(page.request, "social", room.id)).phase).toBe("ROLE_REVEAL");
    await finishSocial(page.request, room.id, clients); await historyClick(page, room.id, "/social/host", true);
    await expect(page.locator(".social-result h2")).toHaveText(/فاز/);
    await page.goto("/profile"); await page.screenshot({ path: info.outputPath("social-completed-history.png"), fullPage: true });
    await info.attach("social-history-route", { body: JSON.stringify({ id: room.id, states: ["LOBBY", "IN_PROGRESS", "COMPLETED"], href: `/social/host/${room.id}` }), contentType: "application/json" });
  } finally { for (const client of clients) await client.api.dispose(); }
});

test("D3 M10 02 Letter profile lobby, active, completed and abandoned links keep dedicated Host routing", async ({ page }, info) => {
  await login(page.request); const room = await create(page.request, "letter-network");
  await historyClick(page, room.id, "/letter-network/host"); await command(page.request, "letter-network", room.id, { type: "START" });
  await historyClick(page, room.id, "/letter-network/host"); await expect(page.locator(".letter-board [data-cell]")).toHaveCount(25);
  await command(page.request, "letter-network", room.id, { type: "END_GAME" }); await command(page.request, "letter-network", room.id, { type: "COMPLETE" });
  await historyClick(page, room.id, "/letter-network/host", true); expect((await read(page.request, "letter-network", room.id)).phase).toBe("COMPLETED");
  const abandoned = await create(page.request, "letter-network"); await command(page.request, "letter-network", abandoned.id, { type: "ABANDON" });
  await historyClick(page, abandoned.id, "/letter-network/host"); expect((await read(page.request, "letter-network", abandoned.id)).phase).toBe("ABANDONED");
  await page.goto("/profile"); await page.screenshot({ path: info.outputPath("letter-history.png"), fullPage: true });
});

test("D3 M10 03 all ten official profile links and shared/distinct legacy histories retain their routes", async ({ page }, info) => {
  test.setTimeout(180_000); await login(page.request);
  const official = [
    ["category-board", "/api/games/category-board", "/play"], ["out-of-the-loop", "/api/social", "/social/host"], ["letter-network", "/api/letter-network", "/letter-network/host"],
    ["survey-show", "/api/survey-show", "/survey-show/host"], ["secret-word", "/api/secret-word", "/secret-word/host"], ["bluff", "/api/bluff", "/bluff/host"],
    ["top-list", "/api/ranked", "/ranked/host"], ["lightning-quiz", "/api/lightning", "/lightning/host"], ["ordering-challenge", "/api/ordering", "/ordering/host"], ["the-court", "/api/court", "/court/host"],
  ];
  const categories = await fixtureSql<{ id: string }>('SELECT id FROM "Category" WHERE slug=ANY($1::text[])', [["general", "saudi", "football", "science", "technology", "cybersecurity"]]); expect(categories).toHaveLength(6);
  const routes: { slug: string; href: string }[] = [];
  for (const [slug, api, prefix] of official) {
    const data = slug === "category-board" ? { categoryIds: categories.map(c => c.id), teamNames: names, timerSeconds: 30 } : slug === "out-of-the-loop" ? { timerSeconds: 60 } : ["letter-network", "survey-show", "secret-word"].includes(slug) ? { names } : slug === "bluff" ? {} : { teams: names };
    const response = await page.request.post(api, { headers, data }); expect(response.status(), await response.text()).toBe(201);
    routes.push({ slug, href: `${prefix}/${(await response.json()).id}` });
  }
  for (const slug of ["letter-battle", "bluff"] as const) {
    await openExistingLegacyLobby(page, slug, "player@example.test"); const id = new URL(page.url()).pathname.split("/").at(-1)!;
    await expect(page.getByRole("heading", { name: "اقلبوا النتيجة", exact: true })).toBeVisible(); routes.push({ slug: `legacy-${slug}`, href: `/play/${id}` });
  }
  await page.goto("/profile"); for (const route of routes) await expect(page.locator(`.history-row a[href="${route.href}"]`)).toBeVisible();
  const legacyLink = page.locator(`.history-row a[href="${routes.at(-1)!.href}"]`); await legacyLink.click(); await expect(page).toHaveURL(origin + routes.at(-1)!.href);
  await expect(page.getByRole("heading", { name: "اقلبوا النتيجة", exact: true })).toBeVisible();
  await info.attach("official-and-legacy-history-matrix", { body: JSON.stringify(routes), contentType: "application/json" });
});

test("D3 M10 04 dedicated history destinations preserve ownership, missing-session and anonymous rejection", async ({ page, browser }) => {
  await login(page.request); const rooms = [await create(page.request, "social"), await create(page.request, "letter-network")];
  const outsider = await browser.newContext(), other = await outsider.newPage(), anonymous = await request.newContext({ baseURL: origin });
  try {
    await login(other.request, true);
    for (let i = 0; i < rooms.length; i++) {
      const game = i === 0 ? "social" : "letter-network", id = rooms[i].id;
      expect((await other.request.get(`/api/${game}/${id}`)).status()).toBe(403);
      expect((await anonymous.get(`/api/${game}/${id}`)).status()).toBe(403);
      expect((await page.request.get(`/api/${game}/missing-d3-session`)).status()).toBe(404);
      await other.goto(`/${game}/host/${id}`); await expect(other.getByRole("heading", { name: "ما لقينا الصفحة", exact: true })).toBeVisible();
      await page.goto(`/${game}/host/missing-d3-session`); await expect(page.getByRole("heading", { name: "ما لقينا الصفحة", exact: true })).toBeVisible();
    }
    await other.goto("/profile"); for (const room of rooms) await expect(other.locator(`.history-row a[href$="/${room.id}"]`)).toHaveCount(0);
  } finally { await outsider.close(); await anonymous.dispose(); }
});

for (const game of ["social", "letter-network", "survey-show"] as const) {
  test(`D3 M11 ${game}: real admin deactivation preserves snapshots; exhaustion rolls back; reactivation enables future content`, async ({ page }, info) => {
    test.setTimeout(150_000); await register(page); const bank = await contentBank(game), admin = await request.newContext({ baseURL: origin });
    const clients: Awaited<ReturnType<typeof join>> = [];
    const toggle = async (id: string, active: boolean) => { const response = await admin.patch(`/api/admin/categories/${id}`, { headers, data: { active } }); expect(response.status(), await response.text()).toBe(200); expect((await response.json()).active).toBe(active); };
    try {
      await login(admin, true); const room = await create(page.request, game); if (game === "social") clients.push(...await join(room));
      await command(page.request, game, room.id, { type: "START" });
      if (game === "social") {
        const round = await socialRound(room.id); expect(round.categoryId).toBe(bank.a.id);
        const normal = clients.find(c => c.id !== round.outsiderId)!, outsider = clients.find(c => c.id === round.outsiderId)!; await toggle(bank.a.id, false);
        const reconnect = await (await normal.api.get(`/api/social/${room.id}/player`)).json(); expect(reconnect.self.secretWord).toBe(round.wordSnapshot);
        expect(JSON.stringify(await (await outsider.api.get(`/api/social/${room.id}/player`)).json())).not.toContain(round.wordSnapshot);
        expect(JSON.stringify(await read(page.request, game, room.id))).not.toContain(round.wordSnapshot);
        await finishSocial(page.request, room.id, clients, round.alternativesSnapshot[0]);
        expect((await read(page.request, game, room.id)).reveal.secretWord).toBe(round.wordSnapshot);
        await toggle(bank.b.id, true); await command(page.request, game, room.id, { type: "REMATCH" });
        const next = await socialRound(room.id); expect(next.categoryId).toBe(bank.b.id);
        const old = (await fixtureSql('SELECT * FROM "SocialRound" WHERE id=$1', [round.id]))[0]; expect(old.wordSnapshot).toBe(round.wordSnapshot); expect(old.alternativesSnapshot).toEqual(round.alternativesSnapshot);
      } else if (game === "letter-network") {
        await command(page.request, game, room.id, { type: "SELECT_CELL", cellId: "r0c0" }); await command(page.request, game, room.id, { type: "OPEN_QUESTION" });
        const use = (await letterUses(room.id))[0]; expect(use.categoryId).toBe(bank.a.id); await toggle(bank.a.id, false);
        expect((await read(page.request, game, room.id)).question.text).toBe(use.questionSnapshot); await command(page.request, game, room.id, { type: "REVEAL_ANSWER" }); expect((await read(page.request, game, room.id)).question.answer).toBe(use.answerSnapshot);
        await command(page.request, game, room.id, { type: "CORRECT" }); await toggle(bank.b.id, true);
        await command(page.request, game, room.id, { type: "SELECT_CELL", cellId: "r0c1" }); const next = (await letterUses(room.id)).find(u => u.id !== use.id)!; expect(next.categoryId).toBe(bank.b.id);
        expect((await letterUses(room.id)).find(u => u.id === use.id)!.answerSnapshot).toBe(use.answerSnapshot);
        await command(page.request, game, room.id, { type: "END_GAME" }); await command(page.request, game, room.id, { type: "COMPLETE" }); await command(page.request, game, room.id, { type: "REMATCH" }); expect((await read(page.request, game, room.id)).board).toHaveLength(25);
      } else {
        const uses = await surveyUses(room.id); expect(uses).toHaveLength(5); expect(uses.every(u => u.categoryId === bank.a.id)).toBe(true);
        const snapshot = uses[0].snapshot as { question: string; answers: { id: string; answer: string }[] }; await toggle(bank.a.id, false);
        expect((await read(page.request, game, room.id)).question.text).toBe(snapshot.question); await command(page.request, game, room.id, { type: "START_ROUND" });
        await command(page.request, game, room.id, { type: "FACE_OFF_GUESS", teamIndex: 0, answerId: snapshot.answers[0].id }); await command(page.request, game, room.id, { type: "FACE_OFF_GUESS", teamIndex: 1, answerId: null }); await command(page.request, game, room.id, { type: "BEGIN_ANSWERING" }); await command(page.request, game, room.id, { type: "GUESS_CORRECT", answerId: snapshot.answers[1].id });
        await command(page.request, game, room.id, { type: "END_GAME" }); await command(page.request, game, room.id, { type: "COMPLETE" }); await toggle(bank.b.id, true); await command(page.request, game, room.id, { type: "REMATCH" });
        const all = await surveyUses(room.id); expect(all).toHaveLength(10); expect(all.filter(u => u.matchNumber === 2).every(u => u.categoryId === bank.b.id)).toBe(true);
        for (const use of uses) expect(all.find(u => u.id === use.id)!.snapshot).toEqual(use.snapshot);
      }
      await toggle(bank.b.id, false); const exhausted = await create(page.request, game);
      const extra = game === "social" ? await join(exhausted) : []; clients.push(...extra);
      const before = await gameplayFootprint(exhausted.id), rejected = await send(page.request, game, exhausted.id, { type: "START" }); expect(rejected.status()).toBe(409);
      const after = await gameplayFootprint(exhausted.id); expect(after).toEqual(before);
      await toggle(bank.b.id, true); await command(page.request, game, exhausted.id, { type: "START" });
      await info.attach("category-eligibility-and-rollback", { body: JSON.stringify({ game, activeCategory: bank.a.id, futureCategory: bank.b.id, before, after, exactZeroMutation: true, normalStartAfterReactivation: true }), contentType: "application/json" });
    } finally { for (const client of clients) await client.api.dispose(); await admin.dispose(); await bank.restore(); }
  });
}
