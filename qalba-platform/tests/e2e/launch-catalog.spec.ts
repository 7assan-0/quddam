import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";
import type { Card, PartyState } from "../../src/lib/games/party/types";

// Independent acceptance matrix: a mistake in the production allowlist must fail these assertions.
const official = [
  { slug: "category-board", title: "لوحة التحدي", page: "/games/category-board/new", api: "/api/games/category-board" },
  { slug: "out-of-the-loop", title: "خارج الجو", page: "/games/out-of-the-loop/new", api: "/api/social" },
  { slug: "letter-network", title: "شبكة الحروف", page: "/games/letter-network/new", api: "/api/letter-network" },
  { slug: "survey-show", title: "قالوا الناس", page: "/games/survey-show/new", api: "/api/survey-show" },
  { slug: "secret-word", title: "الكلمة الممنوعة", page: "/games/secret-word/new", api: "/api/secret-word" },
  { slug: "bluff", title: "صدّقني", page: "/bluff/new", api: "/api/bluff" },
  { slug: "top-list", title: "توب 100", page: "/ranked/new", api: "/api/ranked" },
  { slug: "lightning-quiz", title: "البرق", page: "/lightning/new", api: "/api/lightning" },
  { slug: "ordering-challenge", title: "رتّبها", page: "/ordering/new", api: "/api/ordering" },
  { slug: "the-court", title: "المحكمة", page: "/court/new", api: "/api/court" },
] as const;
const legacyOnly = ["letter-battle", "fastest-mind", "party-court"];
const sharedLegacy = ["survey-show", "secret-word", "bluff", "top-list"];
const genericLegacy = [...legacyOnly, ...sharedLegacy] as PartyState["slug"][];
const origin = "http://127.0.0.1:3000";
const headers = { Origin: origin, "x-quddam-client-ip": "192.0.2.60" };
const legacyInput = { teamNames: ["فريق ألف", "فريق باء"], playerNames: ["زيد", "عمر", "هند"], timerSeconds: 30 };

async function sql<T>(run: (pool: Pool) => Promise<T>) {
  if (!process.env.E2E_DATABASE_URL) throw new Error("Requires the dedicated E2E database");
  const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 2 });
  try { return await run(pool); } finally { await pool.end(); }
}
async function login(api: APIRequestContext, admin = false) {
  const result = await api.post("/api/auth/login", { headers, data: {
    email: admin ? "admin@example.test" : "player@example.test",
    password: admin ? "e2e-admin-password-123" : "e2e-player-password-123",
  } });
  expect(result.status()).toBe(200);
}
async function gameTypes() {
  return sql(async pool => (await pool.query<{ id: string; slug: string; enabled: boolean }>('SELECT id,slug,enabled FROM "GameType" ORDER BY slug')).rows);
}
async function footprint() {
  return sql(async pool => {
    const sessions = (await pool.query('SELECT id,status,state,config,"stateVersion","creditConsumedAt","endedAt","updatedAt" FROM "GameSession" ORDER BY id')).rows;
    const commands = (await pool.query('SELECT * FROM "GameCommand" ORDER BY id')).rows;
    const scores = (await pool.query('SELECT * FROM "ScoreEvent" ORDER BY id')).rows;
    const credits = (await pool.query('SELECT * FROM "GameCredit" ORDER BY id')).rows;
    const wallets = (await pool.query('SELECT * FROM "CreditWallet" ORDER BY "userId"')).rows;
    const gameEvents = (await pool.query('SELECT id,name,properties FROM "AnalyticsEvent" WHERE name IN (\'GAME_CREATED\',\'GAME_STARTED\',\'GAME_COMPLETED\') ORDER BY id')).rows;
    return { sessions, commands, scores, credits, wallets, gameEvents };
  });
}
async function assertLibrary(page: Page) {
  await page.goto("/games"); await expect(page).toHaveTitle(/قدّام/);
  const cards = page.locator("article.game-card"); await expect(cards).toHaveCount(10);
  const records = await gameTypes();
  for (const game of official) {
    const card = cards.filter({ has: page.getByRole("heading", { name: game.title, exact: true }) });
    await expect(card).toHaveCount(1);
    const enabled = records.find(row => row.slug === game.slug)!.enabled;
    if (enabled) await expect(card.getByRole("link")).toHaveAttribute("href", game.page);
    else { await expect(card.getByRole("link")).toHaveCount(0); await expect(card).toContainText("غير متاحة حاليًا"); }
  }
  for (const title of ["حرب الحروف", "خاطف", "محكمة الطاولة", "لعبة غير معروفة"]) await expect(cards.filter({ hasText: title })).toHaveCount(0);
}
async function rejectCreation(api: APIRequestContext, slug: string, status = 404) {
  const result = await api.post(`/api/games/party/${slug}`, { headers, data: legacyInput });
  expect(result.status()).toBe(status); expect(result.headers().location).toBeUndefined();
  expect(await result.json()).toHaveProperty("error");
}
async function assertUnavailableFlow(page: Page, slug: string) {
  const response = await page.goto(`/games/${slug}/new`);
  // Next's existing root loading boundary can stream a 200 shell before notFound().
  // Both transport variants must end at the real noindex 404 UI with no creation form.
  expect([200, 404]).toContain(response?.status());
  await expect(page.getByRole("heading", { name: "ما لقينا الصفحة", exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("button", { name: /يلا قدّام/ })).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);
  return response!.status();
}

test("M15 01 public and signed-in libraries expose exactly ten official games; fresh seed disables legacy", async ({ page }, info) => {
  const records = await gameTypes(); expect(records).toHaveLength(13);
  expect(records.filter(row => row.enabled).map(row => row.slug).sort()).toEqual(official.map(game => game.slug).sort());
  expect(records.filter(row => !row.enabled).map(row => row.slug).sort()).toEqual([...legacyOnly].sort());
  await page.goto("/"); await expect(page).toHaveTitle(/قدّام/);
  const cards = page.locator("#games .game-card"); await expect(cards).toHaveCount(10);
  for (const game of official) await expect(cards.filter({ has: page.getByRole("heading", { name: game.title, exact: true }) })).toHaveCount(1);
  await login(page.request); await assertLibrary(page);
  await page.screenshot({ path: info.outputPath("launch-library.png"), fullPage: true });
  await info.attach("fresh-seed-game-types", { body: JSON.stringify(records), contentType: "application/json" });
});

test("M15 02 all ten official new routes and dedicated creation APIs remain available without START", async ({ page }, info) => {
  test.setTimeout(180_000); await login(page.request); await page.goto("/games");
  const before = await footprint();
  const categories = await sql(async pool => (await pool.query<{ id: string }>('SELECT id FROM "Category" WHERE slug=ANY($1::text[]) ORDER BY slug', [["general", "saudi", "football", "science", "technology", "cybersecurity"]])).rows.map(row => row.id));
  expect(categories).toHaveLength(6);
  const created: { slug: string; id: string }[] = [];
  for (const game of official) {
    const route = await page.goto(game.page); expect(route?.status()).toBe(200);
    await expect(page).toHaveURL(origin + game.page); await expect(page.getByRole("button", { name: /يلا قدّام/ })).toBeVisible();
    const data = game.slug === "category-board" ? { categoryIds: categories, teamNames: legacyInput.teamNames, timerSeconds: 30 }
      : game.slug === "out-of-the-loop" ? { timerSeconds: 30 }
      : ["letter-network", "survey-show", "secret-word"].includes(game.slug) ? { names: legacyInput.teamNames }
      : game.slug === "bluff" ? {} : { teams: legacyInput.teamNames };
    const response = await page.request.post(game.api, { headers, data });
    expect(response.status(), game.api).toBe(201);
    const body = await response.json(); expect(typeof body.id).toBe("string"); created.push({ slug: game.slug, id: body.id });
  }
  const after = await footprint(); expect(after.sessions).toHaveLength(before.sessions.length + 10);
  expect(after.credits).toEqual(before.credits); expect(after.wallets).toEqual(before.wallets);
  expect(after.commands).toEqual(before.commands); expect(after.scores).toEqual(before.scores);
  for (const session of created) {
    const row = await sql(async pool => (await pool.query('SELECT g.status,g."creditConsumedAt",t.slug FROM "GameSession" g JOIN "GameType" t ON t.id=g."gameTypeId" WHERE g.id=$1', [session.id])).rows[0]);
    expect(row).toMatchObject({ slug: session.slug, status: "LOBBY", creditConsumedAt: null });
  }
  await info.attach("official-creation-matrix", { body: JSON.stringify(created), contentType: "application/json" });
});

test("M15 03 all distinct legacy slugs stay hidden and reject NEW GET/POST even if database-enabled", async ({ page }, info) => {
  await login(page.request);
  await sql(pool => pool.query('UPDATE "GameType" SET enabled=true WHERE slug=ANY($1::text[])', [legacyOnly]));
  try {
    await assertLibrary(page); const before = await footprint();
    const getStatuses: { slug: string; status: number }[] = [];
    for (const slug of legacyOnly) {
      getStatuses.push({ slug, status: await assertUnavailableFlow(page, slug) });
      await rejectCreation(page.request, slug);
    }
    const after = await footprint(); expect(after).toEqual(before);
    await info.attach("legacy-rejection-zero-side-effects", { body: JSON.stringify({ slugs: legacyOnly, getStatuses, postStatus: 404, before, after }), contentType: "application/json" });
  } finally { await sql(pool => pool.query('UPDATE "GameType" SET enabled=false WHERE slug=ANY($1::text[])', [legacyOnly])); }
});

test("M15 04 shared official slugs cannot create their older generic variants or stale generic flows", async ({ page }, info) => {
  await login(page.request); const before = await footprint();
  for (const slug of sharedLegacy) await rejectCreation(page.request, slug);
  const getStatuses: { slug: string; status: number }[] = [];
  for (const slug of ["bluff", "top-list"]) getStatuses.push({ slug, status: await assertUnavailableFlow(page, slug) });
  expect(await footprint()).toEqual(before);
  await info.attach("shared-slug-rejections", { body: JSON.stringify({ slugs: sharedLegacy, getStatuses, postStatus: 404, unchanged: true }), contentType: "application/json" });
});

async function legacyFixtures() {
  return sql(async pool => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const owner = (await client.query('SELECT id FROM "User" WHERE email=$1', ["player@example.test"])).rows[0].id;
      const fixtures: { slug: PartyState["slug"]; id: string; state: PartyState }[] = [];
      for (const slug of genericLegacy) {
        const game = (await client.query('SELECT id FROM "GameType" WHERE slug=$1', [slug])).rows[0];
        const cards = (await client.query<Card>('SELECT id,question,answer,type,options,"alternativeAnswers","pointValue" FROM "Question" WHERE "gameTypeId"=$1 ORDER BY id', [game.id])).rows;
        expect(cards.length).toBeGreaterThanOrEqual(slug === "letter-battle" ? 16 : 1);
        const id = crypto.randomUUID(), teamIds = [crypto.randomUUID(), crypto.randomUUID()], playerIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
        const state: PartyState = { schemaVersion: 1, slug, cards, index: 0, phase: "DONE", revealed: true, teamIds, playerIds,
          timerSeconds: 30, deadlineAt: null, remainingMs: 0, turn: 0, owners: slug === "letter-battle" ? Array(16).fill(null) : [],
          selected: null, found: [], strikes: 0, fakes: {}, votes: {}, clues: [], winnerId: teamIds[0], lastCapture: null };
        await client.query('INSERT INTO "GameSession" (id,"gameTypeId","hostId",status,state,"stateVersion","createdAt","endedAt","updatedAt") VALUES ($1,$2,$3,\'COMPLETED\',$4::jsonb,8,$5,$5,$5)', [id, game.id, owner, JSON.stringify(state), "2025-01-01T12:00:00Z"]);
        for (let i = 0; i < 2; i++) await client.query('INSERT INTO "Team" (id,"sessionId",name,color,score,position) VALUES ($1,$2,$3,$4,$5,$6)', [teamIds[i], id, legacyInput.teamNames[i], i ? "#29C7C9" : "#F24C74", i ? 100 : 300, i]);
        for (let i = 0; i < 3; i++) await client.query('INSERT INTO "Player" (id,"sessionId",name,score) VALUES ($1,$2,$3,$4)', [playerIds[i], id, legacyInput.playerNames[i], i + 1]);
        await client.query('INSERT INTO "GameCommand" (id,"sessionId",key,type,"stateVersion") VALUES ($1,$2,\'historical-result\',\'RESULT\',8)', [crypto.randomUUID(), id]);
        await client.query('INSERT INTO "ScoreEvent" (id,"sessionId","teamId",delta,reason,"commandKey") VALUES ($1,$2,$3,300,\'نتيجة محفوظة\',$4)', [crypto.randomUUID(), id, teamIds[0], `historical:${id}`]);
        fixtures.push({ slug, id, state });
      }
      await client.query("COMMIT"); return fixtures;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  });
}

test("M15 05 all seven existing legacy histories/results/display reads survive gating and reseed unchanged", async ({ page }, info) => {
  test.setTimeout(180_000); await login(page.request); await page.goto("/profile");
  const fixtures = await legacyFixtures();
  await sql(pool => pool.query('UPDATE "GameType" SET enabled=false WHERE slug=ANY($1::text[])', [legacyOnly]));
  const before = await footprint();
  for (const fixture of fixtures) {
    const result = await page.request.get(`/api/games/party/sessions/${fixture.id}`); expect(result.status()).toBe(200);
    expect(await result.json()).toMatchObject({ id: fixture.id, slug: fixture.slug, status: "COMPLETED", version: 8, state: fixture.state });
    const display = await page.request.get(`/api/games/party/sessions/${fixture.id}?display=1`); expect(display.status()).toBe(200);
    expect(await display.json()).toMatchObject({ id: fixture.id, status: "COMPLETED", version: 8, teams: expect.arrayContaining([expect.objectContaining({ score: 300 }), expect.objectContaining({ score: 100 })]) });
    expect((await page.goto(`/play/${fixture.id}`))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "النتيجة النهائية", exact: true })).toBeVisible();
    expect((await page.goto(`/play/${fixture.id}/display`))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "الفائز: فريق ألف", exact: true })).toBeVisible();
  }
  await page.goto("/profile"); for (const fixture of fixtures) await expect(page.locator(`a[href="/play/${fixture.id}"]`)).toBeVisible();
  expect(await footprint()).toEqual(before);
  // Existing official availability must survive reseed; legacy definitions must become disabled.
  await sql(pool => pool.query('UPDATE "GameType" SET enabled=(slug<>\'the-court\') WHERE slug=ANY($1::text[])', [["the-court", ...legacyOnly]]));
  await promisify(execFile)(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL }, timeout: 60_000 });
  const types = await gameTypes(); expect(types).toHaveLength(13);
  for (const slug of [...legacyOnly, "the-court"]) expect(types.find(row => row.slug === slug)!.enabled).toBe(false);
  expect(await footprint()).toEqual(before);
  await assertLibrary(page);
  // Ownership remains required for old data; the administrator is not the owner.
  await login(page.request, true);
  expect((await page.request.get(`/api/games/party/sessions/${fixtures[0].id}`)).status()).toBe(403);
  await info.attach("legacy-history-preservation", { body: JSON.stringify({ fixtures: fixtures.map(({ id, slug }) => ({ id, slug })), unchanged: true, stateVersions: fixtures.map(() => 8), ownershipRejection: 403 }), contentType: "application/json" });
});

test("M15 06 admin availability cannot bypass launch eligibility; all ten official toggles remain usable", async ({ page }, info) => {
  await login(page.request, true); const types = await gameTypes();
  for (const slug of legacyOnly) {
    const game = types.find(row => row.slug === slug)!;
    const response = await page.request.patch(`/api/admin/games/${game.id}`, { headers, data: { enabled: true } });
    expect(response.status()).toBe(409); expect((await gameTypes()).find(row => row.id === game.id)!.enabled).toBe(false);
    expect((await page.request.patch(`/api/admin/games/${game.id}`, { headers, data: { enabled: false } })).status()).toBe(200);
  }
  for (const game of official) expect((await page.request.patch(`/api/admin/games/${types.find(row => row.slug === game.slug)!.id}`, { headers, data: { enabled: true } })).status()).toBe(200);
  const court = types.find(row => row.slug === "the-court")!;
  expect((await page.request.patch(`/api/admin/games/${court.id}`, { headers, data: { enabled: false } })).status()).toBe(200);
  await assertLibrary(page); const before = await footprint();
  expect((await page.request.post("/api/court", { headers, data: { teams: legacyInput.teamNames } })).status()).toBe(404);
  expect(await footprint()).toEqual(before);
  expect((await page.request.patch(`/api/admin/games/${court.id}`, { headers, data: { enabled: true } })).status()).toBe(200);
  await assertLibrary(page); await page.goto("/admin/games");
  await expect(page.getByRole("heading", { name: "الألعاب والقدرات", exact: true })).toBeVisible();
  await info.attach("admin-launch-enforcement", { body: JSON.stringify({ legacyEnableStatus: 409, officialEnableCount: 10, availabilityPreserved: true }), contentType: "application/json" });
});

test("M15 07 unknown slugs remain safely rejected and enabled unknown rows stay outside launch catalogue", async ({ page }, info) => {
  await login(page.request); await assertLibrary(page); const slug = `unknown-${crypto.randomUUID()}`;
  const before = await footprint();
  const getStatus = await assertUnavailableFlow(page, slug); await rejectCreation(page.request, slug, 400);
  await sql(pool => pool.query('INSERT INTO "GameType" (id,slug,title,description,enabled) VALUES ($1,$2,\'لعبة غير معروفة\',\'اختبار سياسة الإطلاق\',true)', [crypto.randomUUID(), slug]));
  await assertLibrary(page); const enabledGetStatus = await assertUnavailableFlow(page, slug); await rejectCreation(page.request, slug, 400);
  expect(await footprint()).toEqual(before);
  await info.attach("unknown-slug-rejection", { body: JSON.stringify({ slug, getStatus, enabledGetStatus, renderedNotFound: true, postStatus: 400, zeroMutation: true }), contentType: "application/json" });
});
