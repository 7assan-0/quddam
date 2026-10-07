import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const dbPort = 54000 + Math.floor(Math.random() * 1000);
const appPort = 3100 + Math.floor(Math.random() * 1000);
const origin = `http://127.0.0.1:${appPort}`;
const database = await PGlite.create();
const server = new PGLiteSocketServer({ db: database, host: "127.0.0.1", port: dbPort });
await server.start();
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres?sslmode=disable`,
  DATABASE_POOL_MAX: "1",
  AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  APP_URL: origin,
  SEED_ADMIN_EMAIL: "admin@example.test",
  SEED_ADMIN_PASSWORD: "integration-admin-password-123",
  SEED_USER_EMAIL: "player@example.test",
  SEED_USER_PASSWORD: "integration-player-password-123",
};

function assert(value, label) { if (!value) throw new Error(`Assertion failed: ${label}`); }
function run(binary, args, timeout = 60_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { env });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`Timed out: ${args.join(" ")}\n${output.slice(-1000)}`)); }, timeout);
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(`Failed: ${args.join(" ")}\n${output.slice(-1500)}`));
    });
  });
}

async function post(path, data, cookie = "", extra = {}) {
  const response = await fetch(origin + path, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie, ...extra }, body: JSON.stringify(data),
  });
  return { status: response.status, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "", data: await response.json() };
}

let app;
try {
  await run("./node_modules/.bin/prisma", ["migrate", "deploy"]);
  console.log("Migration applied.");
  await run("npm", ["run", "db:seed"]);
  console.log("Sample data seeded.");
  const counts = await database.query('SELECT (SELECT count(*) FROM "Category") AS categories, (SELECT count(*) FROM "Question") AS questions');
  assert(Number(counts.rows[0].categories) === 23 && Number(counts.rows[0].questions) === 81, "seed counts");

  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "0.0.0.0", "--port", String(appPort)], { env });
  let appOutput = "";
  app.stdout.on("data", (chunk) => { appOutput += chunk; });
  app.stderr.on("data", (chunk) => { appOutput += chunk; });
  let ready = false;
  for (let i = 0; i < 20; i++) {
    try { const response = await fetch(origin, { signal: AbortSignal.timeout(2000) }); if (response.ok) { ready = true; break; } } catch { /* Starting */ }
    if (app.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Web server did not start: ${appOutput.slice(-1000)}`);
  console.log("HTTP server ready.");

  const email = `new-${randomBytes(4).toString("hex")}@example.test`;
  const registration = await post("/api/auth/register", { name: "لاعب الاختبار", email, password: "a-test-password-12345" });
  assert(registration.status === 201 && registration.cookie, "register and session cookie");
  const creditState = async (accountEmail) => database.query('SELECT w.balance, u.id FROM "User" u JOIN "CreditWallet" w ON w."userId" = u.id WHERE u.email = $1', [accountEmail]);
  assert(Number((await creditState(email)).rows[0].balance) === 3, "registration grants configured welcome credits");
  const duplicate = await post("/api/auth/register", { name: "لاعب الاختبار", email, password: "a-test-password-12345" });
  assert(duplicate.status === 409, "duplicate email prevention");
  const wrong = await post("/api/auth/login", { email, password: "wrong-password" });
  assert(wrong.status === 401, "invalid password rejection");
  const login = await post("/api/auth/login", { email, password: "a-test-password-12345" });
  assert(login.status === 200 && login.cookie, "login and session cookie");
  const dashboard = await fetch(origin + "/games", { headers: { Cookie: login.cookie } });
  assert(dashboard.status === 200 && (await dashboard.text()).includes("لاعب الاختبار"), "session survives page refresh");

  const categoryRows = await database.query('SELECT id, slug FROM "Category" WHERE slug IN (\'general\',\'saudi\',\'football\',\'science\',\'technology\',\'cybersecurity\')');
  const boardCategories = ["general", "saudi", "football", "science", "technology", "cybersecurity"].map((slug) => categoryRows.rows.find((row) => row.slug === slug).id);
  const setup = { categoryIds: boardCategories, teamNames: ["البرق", "الموج"], timerSeconds: 30 };
  const invalidBoard = await post("/api/games/category-board", { ...setup, categoryIds: boardCategories.slice(0, 5) }, login.cookie);
  assert(invalidBoard.status === 400, "requires exactly six eligible categories");
  const board = await post("/api/games/category-board", setup, login.cookie);
  assert(board.status === 201 && board.data.cells.length === 18 && board.data.status === "LOBBY", "create board with 18 cells");
  const boardId = board.data.id;
  const roomCreate = await post("/api/rooms", { sessionId: boardId }, login.cookie);
  assert(roomCreate.status === 201 && /^[A-HJ-NP-Z2-9]{6}$/.test(roomCreate.data.code), "host creates six-character room");
  const roomCode = roomCreate.data.code;
  assert((await post("/api/rooms", { sessionId: boardId }, login.cookie)).data.code === roomCode, "room creation retry is idempotent");
  const invalidRoom = await fetch(origin + "/api/rooms/ZZZZZZ/preview");
  assert(invalidRoom.status === 404, "invalid room code rejected");
  const roomPreview = await fetch(origin + `/api/rooms/${roomCode}/preview`);
  assert(roomPreview.status === 200 && (await roomPreview.json()).teams.length === 2, "room preview exposes teams");
  const forbiddenRoom = await fetch(origin + `/api/rooms/${roomCode}`);
  assert(forbiddenRoom.status === 403, "anonymous room state denied");
  const joined = await post(`/api/rooms/${roomCode}/join`, { name: "ضيف الغرفة", teamId: board.data.teams[0].id });
  assert(joined.status === 201 && joined.cookie.includes("qalba_room_"), "guest joins room without account");
  const guestCookie = joined.cookie;
  assert((await post(`/api/rooms/${roomCode}/join`, { name: "ضيف الغرفة", teamId: board.data.teams[0].id })).status === 409, "duplicate guest name denied");
  const readyRoom = await post(`/api/rooms/${roomCode}/ready`, { ready: true }, guestCookie);
  assert(readyRoom.status === 200 && readyRoom.data.participants[0].ready, "guest readiness persists");
  const live = await fetch(origin + `/api/rooms/${roomCode}/events`, { headers: { Cookie: guestCookie } });
  assert(live.status === 200 && live.headers.get("content-type").includes("text/event-stream"), "authenticated SSE stream available");
  await live.body.cancel();
  assert(Number((await creditState(email)).rows[0].balance) === 3, "creating a lobby does not consume credit");
  let view = board.data;
  const send = async (action, key = randomUUID(), expectedVersion = view.version) => {
    const result = await post(`/api/games/category-board/${boardId}/commands`, { key, expectedVersion, action }, login.cookie);
    if (result.status === 200) view = result.data.session;
    return result;
  };
  const startKey = "e719467b-b49a-44a0-ae33-57aa4b3572d4";
  const starts = await Promise.all([send({ type: "START" }, startKey, 0), send({ type: "START" }, startKey, 0)]);
  assert(starts.every((result) => result.status === 200) && starts.filter((result) => result.data.duplicate).length === 1,
    "simultaneous start retry returns one execution and one duplicate");
  assert(Number((await database.query('SELECT count(*) AS total FROM "GameCommand" WHERE "sessionId" = $1 AND key = $2', [boardId, startKey])).rows[0].total) === 1,
    "simultaneous start records one command");
  assert(Number((await database.query('SELECT count(*) AS total FROM "GameCredit" WHERE "idempotencyKey" = $1', [`game-start:${boardId}`])).rows[0].total) === 1,
    "simultaneous start records one credit debit");
  assert(Number((await creditState(email)).rows[0].balance) === 2, "start consumes exactly one credit");
  const duplicateStart = await send({ type: "START" }, startKey, 0);
  assert(duplicateStart.status === 200 && duplicateStart.data.duplicate && view.version === 1, "idempotent start retry");
  assert(Number((await creditState(email)).rows[0].balance) === 2, "duplicate start does not consume a second credit");
  assert((await send({ type: "OPEN", categoryId: boardCategories[0], value: 200 }, randomUUID(), 0)).status === 409, "stale state version rejected");
  assert((await send({ type: "START" })).status === 409, "stale or illegal start rejected");
  const first = await send({ type: "OPEN", categoryId: boardCategories[0], value: 200 });
  assert(first.status === 200 && first.data.session.active.answer === null, "opened answer remains secret");
  const guestState = await fetch(origin + `/api/rooms/${roomCode}`, { headers: { Cookie: guestCookie } });
  const guestView = await guestState.json();
  assert(guestState.status === 200 && guestView.session.active.answer === null && !guestView.session.active.questionId && !guestView.responses, "guest sees safe question projection");
  const guestAnswer = await post(`/api/rooms/${roomCode}/responses`, { response: "توقع الضيف" }, guestCookie);
  assert(guestAnswer.status === 200 && guestAnswer.data.submitted, "guest response accepted");
  assert((await post(`/api/rooms/${roomCode}/responses`, { response: "تكرار" }, guestCookie)).status === 409, "one response per round");
  const hostRoom = await fetch(origin + `/api/rooms/${roomCode}`, { headers: { Cookie: login.cookie } });
  assert((await hostRoom.json()).responses[0].response.text === "توقع الضيف", "only host reviews guest responses");
  assert((await post(`/api/rooms/${roomCode}/ready`, { ready: false }, login.cookie)).status === 403, "host cannot impersonate guest readiness");
  const reportedQuestionId = first.data.session.active.questionId;
  const reportInput = { sessionId: boardId, questionId: reportedQuestionId, reason: "UNCLEAR", details: "صياغة السؤال تحتاج توضيحًا" };
  const report = await post("/api/questions/reports", reportInput, login.cookie);
  assert(report.status === 201 && !report.data.duplicate, "host can report an opened question");
  const reportRepeat = await post("/api/questions/reports", reportInput, login.cookie);
  assert(reportRepeat.status === 200 && reportRepeat.data.duplicate, "duplicate report is prevented");
  assert((await post("/api/questions/reports", { ...reportInput, questionId: "unopened-question" }, login.cookie)).status === 403, "cannot report question not opened in own match");
  const loaded = await fetch(origin + `/api/games/category-board/${boardId}`, { headers: { Cookie: login.cookie } });
  assert(loaded.status === 200 && (await loaded.json()).active.answer === null, "refresh does not reveal answer");
  assert(Number((await creditState(email)).rows[0].balance) === 2, "refresh does not consume credit");
  const display = await fetch(origin + `/play/${boardId}/display`, { headers: { Cookie: login.cookie } });
  const displayHtml = await display.text();
  assert(display.status === 200 && displayHtml.includes("شاشة عرض لوحة التحدي") && !displayHtml.includes("أضف نقاطًا إلى"), "TV projection has no host score controls");
  const doubleKey = randomUUID();
  const doubleVersion = view.version;
  const doublePrior = view.powerUps.find((item) => item.slug === "double" && item.teamId === view.active.answeringTeamId).remaining;
  const doubles = await Promise.all([send({ type: "USE_POWERUP", slug: "double" }, doubleKey, doubleVersion),
    send({ type: "USE_POWERUP", slug: "double" }, doubleKey, doubleVersion)]);
  assert(doubles.every((result) => result.status === 200) && doubles.filter((result) => result.data.duplicate).length === 1,
    "simultaneous power-up retry returns one execution and one duplicate");
  assert(view.active.double && view.powerUps.find((item) => item.slug === "double" && item.teamId === view.active.answeringTeamId).remaining === doublePrior - 1,
    "power-up inventory decremented exactly once");
  assert(Number((await database.query('SELECT count(*) AS total FROM "AnalyticsEvent" WHERE name = $1 AND properties->>\'sessionId\' = $2', ["POWERUP_USED", boardId])).rows[0].total) === 1,
    "power-up usage event occurs once");
  assert((await send({ type: "TIMER_START" })).status === 200 && view.active.deadlineAt, "durable timer deadline");
  assert((await send({ type: "PAUSE_GAME" })).status === 200 && view.status === "PAUSED" && !view.active.deadlineAt, "game pause freezes timer");
  assert((await send({ type: "CORRECT" })).status === 409, "paused game blocks judgment");
  assert((await send({ type: "EDIT_SCORE", teamId: view.teams[0].id, delta: 75 })).status === 200 && view.teams[0].score === 75, "host can edit score while paused");
  assert((await send({ type: "UNDO" })).status === 200 && view.teams.every((team) => team.score === 0), "manual score edit is reversible");
  assert((await send({ type: "RESUME_GAME" })).status === 200 && view.status === "IN_PROGRESS" && view.active.deadlineAt, "resume restores running timer");
  assert((await send({ type: "TIMER_PAUSE" })).status === 200 && !view.active.deadlineAt, "pause timer");
  assert((await send({ type: "USE_POWERUP", slug: "extra-time" })).status === 200 && view.active.remainingMs > 30_000, "extra time");
  assert((await send({ type: "REVEAL" })).status === 200 && view.active.answer, "answer reveal");
  assert((await send({ type: "WRONG" })).status === 200 && view.active.phase === "STEAL", "wrong answer enables steal");
  assert((await send({ type: "USE_POWERUP", slug: "challenge" })).status === 200 && view.active.phase === "CHALLENGE", "challenge power-up");
  assert((await send({ type: "RESOLVE_CHALLENGE", accepted: true })).status === 200 && view.teams.some((team) => team.score === 400), "challenge award");
  assert((await send({ type: "UNDO" })).status === 200 && view.active?.phase === "CHALLENGE" && view.teams.every((team) => team.score === 0), "undo compensates score and restores round");
  assert((await send({ type: "RESOLVE_CHALLENGE", accepted: false })).status === 200 && view.active.phase === "STEAL", "rejected challenge preserves steal");
  const stealKey = randomUUID();
  const stealVersion = view.version;
  const steals = await Promise.all([send({ type: "CORRECT" }, stealKey, stealVersion), send({ type: "CORRECT" }, stealKey, stealVersion)]);
  assert(steals.every((result) => result.status === 200) && steals.filter((result) => result.data.duplicate).length === 1 &&
    view.teams.some((team) => team.score === 200), "simultaneous correct awards once");
  assert(Number((await database.query('SELECT count(*) AS total FROM "ScoreEvent" WHERE "commandKey" = $1', [`${boardId}:${stealKey}`])).rows[0].total) === 1,
    "simultaneous correct records one score event");
  const next = view.cells.find((cell) => !cell.completed);
  assert((await send({ type: "OPEN", categoryId: next.categoryId, value: next.value })).status === 200, "next question opens");
  assert((await send({ type: "USE_POWERUP", slug: "shield" })).status === 200, "shield power-up");
  assert((await send({ type: "WRONG" })).status === 200 && !view.active, "shield blocks stealing");
  for (const cell of view.cells.filter((item) => !item.completed)) {
    assert((await send({ type: "OPEN", categoryId: cell.categoryId, value: cell.value })).status === 200, "open remaining cell");
    assert((await send({ type: "CORRECT" })).status === 200, "score remaining cell");
  }
  assert(view.status === "COMPLETED" && view.cells.every((cell) => cell.completed) && view.endedAt, "full board completes with final scores");
  const displayLinks = [];
  for (let index = 0; index < 3; index++) displayLinks.push(await post(`/api/games/category-board/${boardId}/display-access`, {}, login.cookie));
  assert(displayLinks.every((item) => item.status === 200 && item.data.url.includes("?token=") && item.data.qrDataUrl.startsWith("data:image/png;base64,")),
    "host creates three short-lived display links with real QR images");
  assert((await post(`/api/games/category-board/${boardId}/display-access`, {}, login.cookie)).status === 429,
    "display link creation limits active links");
  const firstToken = new URL(displayLinks[0].data.url, origin).searchParams.get("token");
  assert(Number((await database.query('SELECT count(*) AS total FROM "DisplayAccess" WHERE "sessionId" = $1 AND "tokenHash" = $2', [boardId, firstToken])).rows[0].total) === 0,
    "raw display token is not stored");
  const revokeLinks = await fetch(origin + `/api/games/category-board/${boardId}/display-access`, { method: "DELETE", headers: { Origin: origin, Cookie: login.cookie } });
  assert(revokeLinks.status === 200, "host revokes display links");
  assert((await fetch(origin + `/api/display/${boardId}?token=${firstToken}`)).status === 403, "revoked display link cannot read state");
  const history = await database.query('SELECT count(*) AS total FROM "QuestionHistory" WHERE "userId" = (SELECT id FROM "User" WHERE email = $1)', [email]);
  assert(Number(history.rows[0].total) === 18, "history records each opened question exactly once");
  const rematch = await post("/api/games/category-board", setup, login.cookie);
  assert(rematch.status === 201 && rematch.data.id !== boardId, "rematch creates a distinct session");
  const states = await database.query('SELECT id, state FROM "GameSession" WHERE id = $1 OR id = $2', [boardId, rematch.data.id]);
  const ids = (id) => new Set(states.rows.find((row) => row.id === id).state.cells.map((cell) => cell.questionId));
  assert([...ids(boardId)].every((id) => !ids(rematch.data.id).has(id)), "rematch prefers all fresh questions");
  let rematchVersion = rematch.data.version;
  const sendRematch = async (action) => {
    const result = await post(`/api/games/category-board/${rematch.data.id}/commands`, { key: randomUUID(), expectedVersion: rematchVersion, action }, login.cookie);
    if (result.status === 200) rematchVersion = result.data.session.version;
    return result;
  };
  assert((await sendRematch({ type: "START" })).status === 200, "rematch begins");
  assert(Number((await creditState(email)).rows[0].balance) === 1, "rematch consumes one new credit");
  assert((await sendRematch({ type: "END_GAME" })).data.session.endedEarly, "host can end early with unused cells");
  assert((await sendRematch({ type: "UNDO" })).status === 409, "early end is final");
  const finalCorrection = await sendRematch({ type: "EDIT_SCORE", teamId: rematch.data.teams[0].id, delta: 150 });
  assert(finalCorrection.status === 200 && finalCorrection.data.session.status === "COMPLETED" && finalCorrection.data.session.teams[0].score === 150, "host may correct final score");
  assert((await sendRematch({ type: "UNDO" })).data.session.teams[0].score === 0, "final score correction can be undone");
  await database.query('UPDATE "GameSession" SET "endedAt" = $1 WHERE id = $2', [new Date(Date.now() - 31 * 60 * 1000).toISOString(), rematch.data.id]);
  const expiredView = await (await fetch(origin + `/api/games/category-board/${rematch.data.id}`, { headers: { Cookie: login.cookie } })).json();
  assert(Date.now() - new Date(expiredView.endedAt).getTime() > 30 * 60 * 1000, "completed display grace is expired in authoritative state");
  const expiredDisplay = await post(`/api/games/category-board/${rematch.data.id}/display-access`, {}, login.cookie);
  assert(expiredDisplay.status === 410, `completed game outside grace period cannot create a useless display link: ${expiredDisplay.status}`);
  const third = await post("/api/games/category-board", setup, login.cookie);
  assert(third.status === 201, "third lobby is created with remaining credit");
  assert((await post(`/api/games/category-board/${third.data.id}/commands`, { key: randomUUID(), expectedVersion: 0, action: { type: "START" } }, login.cookie)).status === 200, "third match starts");
  assert(Number((await creditState(email)).rows[0].balance) === 0, "third match exhausts balance");
  const fourth = await post("/api/games/category-board", setup, login.cookie);
  assert(fourth.status === 201, "creating lobby is free even with zero balance");
  const fourthStart = () => post(`/api/games/category-board/${fourth.data.id}/commands`, { key: randomUUID(), expectedVersion: 0, action: { type: "START" } }, login.cookie);
  assert((await fourthStart()).status === 402, "insufficient balance rejects start");
  const fourthState = await database.query('SELECT status, "creditConsumedAt" FROM "GameSession" WHERE id = $1', [fourth.data.id]);
  assert(fourthState.rows[0].status === "LOBBY" && !fourthState.rows[0].creditConsumedAt, "rejected start keeps lobby unchanged");
  const profile = await fetch(origin + "/profile", { headers: { Cookie: login.cookie } });
  const profileHtml = await profile.text();
  assert(profile.status === 200 && profileHtml.includes("مبارياتك") && profileHtml.includes("حركة الرصيد") && profileHtml.includes("لا توجد مشتريات"), "profile displays games, wallet ledger and empty purchase history");

  const forbidden = await post("/api/admin/categories", { slug: "test-category", title: "فئة الاختبار" }, login.cookie);
  assert(forbidden.status === 403, "ordinary user cannot manage categories");
  assert((await post("/api/admin/credits/grants", { email, amount: 2, key: randomUUID() }, login.cookie)).status === 403, "ordinary user cannot grant credits");
  const crossOrigin = await post("/api/admin/categories", { slug: "test-category", title: "فئة الاختبار" }, login.cookie, { Origin: "https://other.example" });
  assert(crossOrigin.status === 403, "cross-origin mutation blocked");

  const admin = await post("/api/auth/login", { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD });
  assert(admin.status === 200 && admin.cookie, "seeded admin login");
  const adminDashboard = await fetch(origin + "/admin", { headers: { Cookie: admin.cookie } });
  assert(adminDashboard.status === 200 && (await adminDashboard.text()).includes("مباريات اليوم"), "admin dashboard shows real metrics");
  const usersPage = await fetch(origin + "/admin/users", { headers: { Cookie: admin.cookie } });
  assert(usersPage.status === 200 && (await usersPage.text()).includes("المستخدمون"), "admin user management page");
  const reportsPage = await fetch(origin + "/admin/reports", { headers: { Cookie: admin.cookie } });
  assert(reportsPage.status === 200 && (await reportsPage.text()).includes("صياغة السؤال تحتاج توضيحًا"), "admin sees player question report");
  const reportId = (await database.query('SELECT id FROM "QuestionReport" WHERE "questionId" = $1', [reportedQuestionId])).rows[0].id;
  const review = await fetch(origin + `/api/admin/reports/${reportId}`, { method: "PATCH", headers: { Origin: origin, Cookie: admin.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ status: "RESOLVED", archiveQuestion: true }) });
  assert(review.status === 200, "admin resolves report and archives question");
  const archived = await database.query('SELECT status FROM "Question" WHERE id = $1', [reportedQuestionId]);
  assert(archived.rows[0].status === "ARCHIVED", "moderation archives question for future matches");
  const boardType = await database.query('SELECT id FROM "GameType" WHERE slug = $1', ["category-board"]);
  const otherType = await database.query('SELECT id FROM "GameType" WHERE slug = $1', ["bluff"]);
  const patch = (path, input, cookie = admin.cookie) => fetch(origin + path, { method: "PATCH", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  assert((await patch(`/api/admin/games/${otherType.rows[0].id}`, { enabled: false })).status === 200, "admin can disable additional game");
  assert((await patch(`/api/admin/games/${otherType.rows[0].id}`, { enabled: true })).status === 200, "admin can enable additional game");
  assert((await patch(`/api/admin/games/${boardType.rows[0].id}`, { enabled: false })).status === 200, "admin can disable new game creation");
  assert((await patch(`/api/admin/games/${boardType.rows[0].id}`, { enabled: true })).status === 200, "admin can re-enable Category Board");
  const powerId = (await database.query('SELECT id FROM "PowerUp" WHERE slug = $1', ["double"])).rows[0].id;
  assert((await patch(`/api/admin/powers/${powerId}`, { enabled: true, initialCount: 2 })).status === 200, "admin configures power usage");
  assert((await patch(`/api/admin/powers/${powerId}`, { initialCount: -1, enabled: true })).status === 400, "invalid power config rejected");
  const product = await post("/api/admin/products", { slug: "three-games", title: "ثلاث ألعاب", credits: 3, priceHalalas: 1500, active: false }, admin.cookie);
  assert(product.status === 201, "admin creates database-priced product");
  assert((await patch(`/api/admin/products/${product.data.id}`, { slug: "three-games", title: "ثلاث ألعاب", credits: 3, priceHalalas: 1800, active: true })).status === 200, "admin changes product price");
  const pricingPage = await fetch(origin + "/pricing", { headers: { Cookie: login.cookie } });
  assert(pricingPage.status === 200 && (await pricingPage.text()).includes("ثلاث ألعاب"), "player sees database-priced product");
  assert((await post("/api/billing/checkout", { productId: product.data.id, key: randomUUID() }, login.cookie)).status === 503, "checkout fails closed without provider key");
  assert((await post("/api/billing/checkout", { productId: product.data.id, key: randomUUID() })).status === 403, "anonymous checkout denied");
  const coupon = await post("/api/admin/coupons", { code: "HELLO10", discountPercent: 10, discountHalalas: null, maxUses: 100, expiresAt: null, active: true }, admin.cookie);
  assert(coupon.status === 201, "admin creates coupon");
  assert((await post("/api/admin/coupons", { code: "BAD", discountPercent: 10, discountHalalas: 100, maxUses: null, expiresAt: null, active: true }, admin.cookie)).status === 400, "ambiguous coupon discount rejected");
  assert((await post("/api/admin/features", { key: "future-mode", enabled: false, config: { roundTime: 45 } }, admin.cookie)).status === 200, "admin saves future feature flag");
  assert((await post("/api/admin/features", { key: "welcome-credits", enabled: false, config: {} }, admin.cookie)).status === 409, "welcome-credit config stays on guarded route");
  const header = "gameSlug,categorySlug,question,answer,alternativeAnswers,explanation,difficulty,pointValue,type,options,source,status,language,country,subcategory,imageUrl";
  const importCsv = `${header}\ncategory-board,general,ما اسم العدد بعد الواحد؟,اثنان,,,EASY,200,TEXT,,محتوى أصلي,DRAFT,ar,,,`;
  const preview = await post("/api/admin/questions/import", { csv: importCsv, dryRun: true }, admin.cookie);
  assert(preview.status === 200 && preview.data.valid === 1 && preview.data.errors.length === 0, "CSV preview validates original content");
  const badCsv = `${header}\ncategory-board,general,ما اسم سؤال صالح للاستيراد؟,اسم,,,EASY,200,TEXT,,مصدر,DRAFT,ar,,,\ncategory-board,general,ما اسم سؤال غير صالح للنقاط؟,اسم,,,EASY,-5,TEXT,,مصدر,DRAFT,ar,,,`;
  const invalidPreview = await post("/api/admin/questions/import", { csv: badCsv, dryRun: true }, admin.cookie);
  assert(invalidPreview.status === 200 && invalidPreview.data.errors.length === 1, "CSV preview identifies invalid row");
  assert((await post("/api/admin/questions/import", { csv: badCsv, dryRun: false }, admin.cookie)).status === 400, "invalid batch rejected without partial import");
  const imported = await post("/api/admin/questions/import", { csv: importCsv, dryRun: false }, admin.cookie);
  assert(imported.status === 201 && imported.data.created === 1, "CSV imports validated batch");
  const repeatImport = await post("/api/admin/questions/import", { csv: importCsv, dryRun: false }, admin.cookie);
  assert(repeatImport.status === 409, "duplicate database question rejected on import");
  const exportResponse = await fetch(origin + "/api/admin/questions/export", { headers: { Cookie: admin.cookie } });
  assert(exportResponse.status === 200 && (await exportResponse.text()).includes("ما اسم العدد بعد الواحد؟"), "admin CSV export includes imported question");
  const exportForbidden = await fetch(origin + "/api/admin/questions/export", { headers: { Cookie: login.cookie } });
  assert(exportForbidden.status === 403, "ordinary user cannot export question bank");
  const usersExport = await fetch(origin + "/api/admin/export?dataset=users", { headers: { Cookie: admin.cookie } });
  assert(usersExport.status === 200 && (await usersExport.text()).includes(email), "admin can export account data as CSV");
  assert((await fetch(origin + "/api/admin/export?dataset=users", { headers: { Cookie: login.cookie } })).status === 403, "ordinary user cannot export account data");
  const grantKey = randomUUID();
  const grant = await post("/api/admin/credits/grants", { email, amount: 2, key: grantKey }, admin.cookie);
  assert(grant.status === 200 && grant.data.balance === 2 && !grant.data.duplicate, "admin grants two credits");
  const grantRetry = await post("/api/admin/credits/grants", { email, amount: 2, key: grantKey }, admin.cookie);
  assert(grantRetry.status === 200 && grantRetry.data.duplicate && grantRetry.data.balance === 2, "admin grant retry is idempotent");
  assert((await post("/api/admin/credits/grants", { email, amount: 3, key: grantKey }, admin.cookie)).status === 409, "grant key cannot be reused for another amount");
  assert((await fourthStart()).status === 200 && Number((await creditState(email)).rows[0].balance) === 1, "new grant allows previously rejected match to start");
  const creditsPage = await fetch(origin + "/admin/credits", { headers: { Cookie: admin.cookie } });
  assert(creditsPage.status === 200 && (await creditsPage.text()).includes("منح الرصيد"), "admin credits page renders");
  const creditsForbidden = await fetch(origin + "/admin/credits", { headers: { Cookie: login.cookie } });
  const creditsForbiddenHtml = await creditsForbidden.text();
  assert(!creditsForbiddenHtml.includes("منح رصيد لحساب") && creditsForbiddenHtml.includes("404"), "ordinary user sees not-found view without credit controls");
  const settings = await fetch(origin + "/api/admin/credits/settings", { method: "PATCH", headers: { Origin: origin, Cookie: admin.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ count: 2, enabled: true }) });
  assert(settings.status === 200, "admin can update welcome setting");
  const laterEmail = `later-${randomBytes(4).toString("hex")}@example.test`;
  assert((await post("/api/auth/register", { name: "لاعب جديد", email: laterEmail, password: "a-test-password-12345" })).status === 201, "new registration after setting change");
  assert(Number((await creditState(laterEmail)).rows[0].balance) === 2 && Number((await creditState(email)).rows[0].balance) === 1, "new setting applies only once to newly registered account");
  const otherHost = await fetch(origin + `/api/games/category-board/${boardId}`, { headers: { Cookie: admin.cookie } });
  assert(otherHost.status === 403, "other account cannot see host game");
  const category = await post("/api/admin/categories", { slug: "test-category", title: "فئة الاختبار" }, admin.cookie);
  assert(category.status === 201, "admin can create category");
  const game = await database.query('SELECT id FROM "GameType" WHERE slug = $1', ["category-board"]);
  const question = await post("/api/admin/questions", {
    gameTypeId: game.rows[0].id, categoryId: category.data.id, question: "كم ضلعًا للمثلث؟", answer: "ثلاثة",
    difficulty: "EASY", pointValue: 200, type: "TEXT", status: "DRAFT",
  }, admin.cookie);
  assert(question.status === 201, "admin can create question");
  const recovery = await post("/api/auth/forgot", { email });
  assert(recovery.status === 503, "unconfigured email recovery is explicit");
  const account = await database.query('SELECT id FROM "User" WHERE email = $1', [email]);
  const resetToken = randomBytes(32).toString("base64url");
  await database.query('INSERT INTO "PasswordReset" (id, "userId", "tokenHash", "expiresAt") VALUES ($1, $2, $3, $4)', [
    `reset-${randomBytes(8).toString("hex")}`, account.rows[0].id,
    createHash("sha256").update(resetToken).digest("hex"), new Date(Date.now() + 30 * 60_000).toISOString(),
  ]);
  const reset = await post("/api/auth/reset", { token: resetToken, password: "another-test-password-123" });
  assert(reset.status === 200, "valid recovery token changes password");
  const repeatedReset = await post("/api/auth/reset", { token: resetToken, password: "third-test-password-123" });
  assert(repeatedReset.status === 400, "recovery token is single use");
  const oldPassword = await post("/api/auth/login", { email, password: "a-test-password-12345" });
  assert(oldPassword.status === 401, "old password rejected after reset");
  const newLogin = await post("/api/auth/login", { email, password: "another-test-password-123" });
  assert(newLogin.status === 200, "new password accepted");
  const logout = await post("/api/auth/logout", {}, newLogin.cookie);
  assert(logout.status === 200, "logout revokes session");
  const storedTokenHash = createHash("sha256").update(newLogin.cookie.split("=")[1]).digest("hex");
  const revokedSession = await database.query('SELECT "revokedAt" FROM "AuthSession" WHERE "tokenHash" = $1', [storedTokenHash]);
  assert(Boolean(revokedSession.rows[0]?.revokedAt), "session is revoked in database");
  const revoked = await post("/api/admin/categories", { slug: "revoked", title: "ملغاة" }, newLogin.cookie);
  assert(revoked.status === 403, "revoked user session stays non-admin");
  const seedPlayer = (await database.query('SELECT id FROM "User" WHERE email = $1', [env.SEED_USER_EMAIL])).rows[0].id;
  const seedPlayerLogin = await post("/api/auth/login", { email: env.SEED_USER_EMAIL, password: env.SEED_USER_PASSWORD });
  assert(seedPlayerLogin.status === 200, "seed user can log in before suspension");
  assert((await patch(`/api/admin/users/${seedPlayer}`, { suspended: true })).status === 200, "admin suspends user");
  assert((await post("/api/games/category-board", setup, seedPlayerLogin.cookie)).status === 403, "suspension invalidates already-issued session for game mutations");
  assert((await post("/api/auth/login", { email: env.SEED_USER_EMAIL, password: env.SEED_USER_PASSWORD })).status === 403, "suspended account cannot log in");
  assert((await patch(`/api/admin/users/${seedPlayer}`, { suspended: false })).status === 200, "admin reactivates user");
  assert((await post("/api/auth/login", { email: env.SEED_USER_EMAIL, password: env.SEED_USER_PASSWORD })).status === 200, "reactivated account can log in");
  const adminId = (await database.query('SELECT id FROM "User" WHERE email = $1', [env.SEED_ADMIN_EMAIL])).rows[0].id;
  assert((await patch(`/api/admin/users/${adminId}`, { role: "USER" })).status === 409, "admin cannot demote self");
  // The embedded socket supports one client at a time; release Next's pool before rerunning the seed.
  app.kill("SIGTERM");
  await new Promise((resolve) => { app.once("exit", resolve); setTimeout(resolve, 3000); });
  await database.query('UPDATE "GameType" SET enabled = false WHERE slug = $1', ["category-board"]);
  await database.query('UPDATE "PowerUp" SET config = $1::jsonb WHERE slug = $2', [JSON.stringify({ initialCount: 3 }), "double"]);
  await run("npm", ["run", "db:seed"]);
  const preserved = await database.query('SELECT g.enabled, p.config FROM "GameType" g JOIN "PowerUp" p ON p."gameTypeId" = g.id WHERE g.slug = $1 AND p.slug = $2', ["category-board", "double"]);
  assert(preserved.rows[0].enabled === false && preserved.rows[0].config.initialCount === 3, "reseed preserves admin game and power settings");
  const creditSetting = await database.query('SELECT enabled, config FROM "FeatureFlag" WHERE key = $1', ["welcome-credits"]);
  assert(creditSetting.rows[0].enabled === true && creditSetting.rows[0].config.count === 2, "reseed preserves admin welcome-credit setting");
  const ledger = await database.query('SELECT "idempotencyKey", delta FROM "GameCredit" WHERE "userId" = (SELECT id FROM "User" WHERE email = $1)', [email]);
  assert(ledger.rows.filter((row) => row.delta === -1).length === 4 && new Set(ledger.rows.map((row) => row.idempotencyKey)).size === ledger.rows.length, "one unique debit per started session");
  console.log("Integration passed: full board and credits; admin users, game/power/pricing/flags, CSV import/export, reports/moderation, analytics, auth/CSRF and reseed preservation.");
} finally {
  if (app && app.exitCode === null) { app.kill("SIGTERM"); await new Promise((resolve) => { app.once("exit", resolve); setTimeout(resolve, 3000); }); }
  await server.stop();
  await database.close();
}
