import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
type Client = { page: Page; context: BrowserContext; id: string; role: string | null; secretWord: string | null };
const read = async (page: Page, id: string, audience: "host" | "player") => (await (audience === "host" ? page.request.get(`/api/social/${id}`) : page.request.get(`/api/social/${id}/player`))).json();
async function hostRoom(page: Page) {
  await page.goto("/register");
  await page.getByLabel("الاسم").fill("مضيف الاجتماع");
  await page.getByLabel("البريد الإلكتروني").fill(`social-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`);
  await page.getByLabel("كلمة المرور").fill("social-password-123456");
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await expect(page).toHaveURL(/\/games$/);
  await page.goto("/games/out-of-the-loop/new");
  await page.getByRole("button", { name: "أنشئ الغرفة" }).click();
  await expect(page).toHaveURL(/\/social\/host\/[^/]+$/);
  const id = page.url().split("/").at(-1)!;
  const view = await read(page, id, "host");
  return { id, code: view.code as string };
}
async function playersJoin(browser: Browser, id: string, code: string, count = 4) {
  const clients: Client[] = [];
  for (let index = 0; index < count; index++) {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto(`/social/join?code=${code}`);
    await page.getByLabel("اسمك في اللعبة").fill(`لاعب ${index + 1}`);
    const joinResponse = page.waitForResponse(response => response.url().includes("/api/social/") && response.request().method() === "POST", { timeout: 8_000 }).catch(() => null);
    await page.getByRole("button", { name: "ادخل اللعبة" }).click();
    const response = await joinResponse;
    if (!response) throw new Error(`لا يوجد طلب انضمام ${index + 1}: ${page.url()} / ${await page.locator("main").last().innerText()}`);
    if (!response.ok()) throw new Error(`الانضمام ${index + 1}: ${response.status()} ${await response.text()}`);
    await expect(page).toHaveURL(new RegExp(`/social/play/${id}$`));
    clients.push({ context, page, id: "", role: null, secretWord: null });
  }
  return clients;
}
async function roles(page: Page, clients: Client[], id: string) {
  await page.getByRole("button", { name: "ابدأ اللعبة" }).click();
  await expect(page.getByRole("heading", { name: "وزّعت الأدوار الخاصة" })).toBeVisible();
  for (const [index, client] of clients.entries()) {
    const view = await read(client.page, id, "player");
    client.id = view.self.id; client.role = view.self.role; client.secretWord = view.self.secretWord;
    try { await expect(client.page.getByRole("heading", { name: client.role === "OUTSIDER" ? "أنت خارج الجو" : "أنت تعرف الكلمة" })).toBeVisible({ timeout: 15_000 }); }
    catch (error) { throw new Error(`لاعب ${index + 1}: الخادم ${view.phase} / الواجهة ${await client.page.locator("main").last().innerText()}`, { cause: error }); }
  }
  expect(clients.filter(client => client.role === "OUTSIDER")).toHaveLength(1);
  expect(new Set(clients.filter(client => client.role === "PLAYER").map(client => client.secretWord)).size).toBe(1);
  expect(clients.find(client => client.role === "OUTSIDER")!.secretWord).toBeNull();
}
async function discussion(page: Page, clients: Client[]) {
  await page.getByRole("button", { name: "ابدأ النقاش" }).click();
  for (const client of clients) await client.page.getByRole("button", { name: "انتهيت" }).click();
  await expect(page.getByRole("heading", { name: "التصويت جارٍ" })).toBeVisible();
}
async function vote(client: Client, sessionId: string, targetId: string) {
  const view = await read(client.page, sessionId, "player");
  return client.page.request.post(`/api/social/${sessionId}/commands`, { headers: { Origin: "http://127.0.0.1:3000" },
    data: { key: crypto.randomUUID(), expectedVersion: view.version, action: { type: "SUBMIT_VOTE", roundId: view.roundId, ballot: view.ballot, targetId } } });
}
async function close(clients: Client[]) { await Promise.all(clients.map(client => client.context.close())); }

test("four phones receive private roles; correct vote and wrong guess let players win", async ({ page, browser }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const { id, code } = await hostRoom(page); const clients = await playersJoin(browser, id, code);
  try {
    await expect(page.getByText("انضم 4 من ١٢")).toBeVisible();
    await roles(page, clients, id);
    await clients[0].page.setViewportSize({ width: 390, height: 844 });
    expect(await clients[0].page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const host = await read(page, id, "host");
    expect(JSON.stringify(host)).not.toContain(clients.find(c => c.role === "PLAYER")!.secretWord!);
    expect(JSON.stringify(host)).not.toContain("outsiderId");
    const outsider = clients.find(c => c.role === "OUTSIDER")!;
    const other = await (await clients[0].page.request.get(`/api/social/${id}/player?playerId=${clients[1].id}`)).json();
    expect(other.self.id).toBe(clients[0].id);
    expect((await browser.newContext().then(async context => { try { return (await context.request.get(`/api/social/${id}/player`)).status(); } finally { await context.close(); } }))).toBe(403);
    await discussion(page, clients);
    for (const client of clients) {
      const target = client.id === outsider.id ? clients.find(c => c.id !== outsider.id)!.id : outsider.id;
      expect((await vote(client, id, target)).status()).toBe(200);
    }
    await expect(page.getByRole("heading", { name: "انكشف خارج الجو" })).toBeVisible();
    await outsider.page.reload();
    await expect(outsider.page.getByRole("heading", { name: "بطاقتك مخفية" })).toBeVisible();
    await outsider.page.getByRole("button", { name: "إظهار بطاقتي" }).click();
    await expect(outsider.page.getByRole("heading", { name: "أنت خارج الجو" })).toBeVisible();
    await outsider.page.getByLabel("ما الكلمة السرية؟").fill("كلمة خاطئة أكيد");
    await outsider.page.getByRole("button", { name: "أرسل التخمين" }).click();
    await expect(page.getByRole("heading", { name: "فاز اللاعبون!" })).toBeVisible();
    await page.getByRole("button", { name: "ثبّت النتيجة" }).click();
    await expect(page.getByRole("button", { name: "إعادة المباراة بنفس اللاعبين" })).toBeVisible();
    await page.getByRole("button", { name: "إعادة المباراة بنفس اللاعبين" }).click();
    await expect(page.getByRole("heading", { name: "وزّعت الأدوار الخاصة" })).toBeVisible();
    const after = await read(outsider.page, id, "player");
    expect(after.round).toBe(2); expect(after.reveal).toBeNull(); expect(after.tally).toBeNull();
    expect(after.self.secretWord).not.toBe(clients.find(c => c.role === "PLAYER")!.secretWord);
  } finally { await close(clients); }
});

test("wrong accusation lets outsider win; TV and host never receive early secret or private ballots", async ({ page, browser }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const { id, code } = await hostRoom(page); const clients = await playersJoin(browser, id, code);
  const tvContext = await browser.newContext(); const tv = await tvContext.newPage();
  try {
    await roles(page, clients, id);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "فتح شاشة العرض" }).click();
    const modal = page.getByRole("dialog", { name: "رابط شاشة العرض" });
    await expect(modal.getByRole("img", { name: "رمز QR لرابط شاشة العرض" })).toHaveAttribute("src", /^data:image\/png;base64,/);
    const link = await modal.getByRole("link", { name: "فتح العرض في هذا الجهاز" }).getAttribute("href");
    await modal.getByRole("button", { name: "نسخ رابط العرض" }).click();
    expect(new URL(await page.evaluate(() => navigator.clipboard.readText())).pathname).toBe(`/social/display/${id}`);
    await tv.goto(link!); await expect(tv.getByRole("heading", { name: "اطّلعوا على بطاقاتكم" })).toBeVisible();
    const secret = clients.find(c => c.role === "PLAYER")!.secretWord!;
    expect((await tvContext.request.get(`/api/social/${id}/display?token=invalid`)).status()).toBe(403);
    expect(await tv.locator("body").innerText()).not.toContain(secret);
    expect(JSON.stringify(await (await tvContext.request.get(`/api/social/${id}/display?token=${new URL(link!, "http://127.0.0.1:3000").searchParams.get("token")}`)).json())).not.toContain(secret);
    const denied = await tvContext.request.post(`/api/social/${id}/commands`, { headers: { Origin: "http://127.0.0.1:3000" }, data: { key: crypto.randomUUID(), expectedVersion: 0, action: { type: "START" } } });
    expect(denied.status()).toBe(403);
    await modal.getByRole("button", { name: "إغلاق" }).click();
    await discussion(page, clients);
    const accused = clients.find(c => c.role === "PLAYER")!;
    for (const client of clients) {
      const target = client.id === accused.id ? clients.find(c => c.role === "PLAYER" && c.id !== accused.id)!.id : accused.id;
      expect((await vote(client, id, target)).status()).toBe(200);
    }
    await expect(page.getByRole("heading", { name: "فاز خارج الجو!" })).toBeVisible();
    await expect(tv.getByText(`الكلمة السرية: ${secret}`)).toBeVisible();
    await page.reload(); await expect(page.getByRole("button", { name: "إلغاء رابط العرض" })).toBeVisible();
    await page.getByRole("button", { name: "إلغاء رابط العرض" }).click();
    await expect(page.getByRole("button", { name: "إلغاء رابط العرض" })).toHaveCount(0);
    expect((await tvContext.request.get(`/api/social/${id}/display?token=${new URL(link!, "http://127.0.0.1:3000").searchParams.get("token")}`)).status()).toBe(403);
  } finally { await close(clients); await tvContext.close(); }
});

test("tie leads to runoff with eligible candidates and a deterministic resolution", async ({ page, browser }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const { id, code } = await hostRoom(page); const clients = await playersJoin(browser, id, code);
  try { await roles(page, clients, id); await discussion(page, clients);
    const [a,b,c,d] = clients;
    for (const [voter, target] of [[a,b],[b,a],[c,a],[d,b]] as const) expect((await vote(voter, id, target.id)).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "تصويت الحسم" })).toBeVisible();
    const round = await read(page, id, "host"); expect(round.candidates).toEqual([a.id,b.id]); expect(round.ballot).toBe(2);
    for (const [voter, target] of [[a,b],[b,a],[c,a],[d,a]] as const) expect((await vote(voter, id, target.id)).status()).toBe(200);
    const result = await read(page, id, "host"); expect(["RESULTS","OUTSIDER_GUESS"]).toContain(result.phase); expect(result.suspectedId).toBe(a.id);
  } finally { await close(clients); }
});

test("same concurrent command executes once; duplicate vote and stale actions cannot double advance", async ({ page, browser }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const { id, code } = await hostRoom(page); const clients = await playersJoin(browser, id, code, 3);
  try { const before = await read(page, id, "host"); const key = crypto.randomUUID();
    const result = await page.evaluate(async ({ id, version, key }) => {
      const send = () => fetch(`/api/social/${id}/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, expectedVersion: version, action: { type: "START" } }) }).then(async r => ({ status: r.status, body: await r.json() }));
      return Promise.all([send(), send()]);
    }, { id, version: before.version, key });
    expect(result.map(r => r.status)).toEqual([200,200]); expect(result.map(r => r.body.duplicate).sort()).toEqual([false,true]);
    const started = await read(page, id, "host"); expect(started.version).toBe(before.version + 1); expect(started.round).toBe(1);
    const reused = await page.evaluate(async ({ id, version, key }) => fetch(`/api/social/${id}/commands`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, expectedVersion: version, action: { type: "BEGIN_DISCUSSION" } }) }).then(r => r.json()), { id, version: before.version, key });
    expect(reused.code).toBe("COMMAND_KEY_REUSED");
    const stale = await page.evaluate(async ({ id, version }) => fetch(`/api/social/${id}/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: crypto.randomUUID(), expectedVersion: version, action: { type: "BEGIN_DISCUSSION" } }) }).then(r => r.json()), { id, version: before.version });
    expect(stale.code).toBe("STALE_GAME_STATE");
    await page.reload(); await rolesAlready(clients, id);
    await page.getByRole("button", { name: "ابدأ النقاش" }).click();
    for (const client of clients) await client.page.getByRole("button", { name: "انتهيت" }).click();
    const voter = clients[0], candidate = clients[1]; const view = await read(voter.page, id, "player"); const voteKey = crypto.randomUUID();
    const votes = await voter.page.evaluate(async ({ id, version, voteKey, targetId, roundId, ballot }) => {
      const send = () => fetch(`/api/social/${id}/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: voteKey, expectedVersion: version, action: { type: "SUBMIT_VOTE", roundId, ballot, targetId } }) }).then(async r => ({ status: r.status, body: await r.json() }));
      return Promise.all([send(), send()]);
    }, { id, version: view.version, voteKey, targetId: candidate.id, roundId: view.roundId, ballot: view.ballot });
    expect(votes.map(v => v.status)).toEqual([200,200]); expect(votes.map(v => v.body.duplicate).sort()).toEqual([false,true]);
    expect((await read(page, id, "host")).voteCount).toBe(1);
    const sharedVoteView = await read(page, id, "host");
    const sharedVersion = sharedVoteView.version;
    const simultaneous = await Promise.all(clients.slice(1).map((client, index) =>
      client.page.request.post(`/api/social/${id}/commands`, { headers: { Origin: "http://127.0.0.1:3000" },
        data: { key: crypto.randomUUID(), expectedVersion: sharedVersion, action: { type: "SUBMIT_VOTE", roundId: sharedVoteView.roundId, ballot: sharedVoteView.ballot, targetId: clients[0].id } } })
        .then(async response => ({ status: response.status(), body: await response.json(), index })) ));
    expect(simultaneous.map(v => v.status).sort()).toEqual([200,409]);
    expect(simultaneous.find(v => v.status === 409)?.body.code).toBe("STALE_GAME_STATE");
    const retryIndex = simultaneous.find(v => v.status === 409)!.index + 1;
    expect((await vote(clients[retryIndex], id, clients[0].id)).status()).toBe(200);
    expect((await read(page, id, "host")).voteCount).toBe(3);
  } finally { await close(clients); }
});
async function rolesAlready(clients: Client[], id: string) { for (const client of clients) { const view = await read(client.page, id, "player"); client.id = view.self.id; client.role = view.self.role; client.secretWord = view.self.secretWord; } }

test("social TV stays live across 30 seconds without fallback polling", async ({ page, browser }) => {
  test.setTimeout(90_000);
  test.skip(!process.env.E2E_DATABASE_URL);
  const { id, code } = await hostRoom(page); const clients = await playersJoin(browser, id, code, 3);
  const tvContext = await browser.newContext(); const tv = await tvContext.newPage();
  try {
    const access = await page.evaluate(async id => (await fetch(`/api/social/${id}/display-access`, { method: "POST" })).json(), id);
    const reads: string[] = [], streams: string[] = [];
    tv.on("request", request => { const path = new URL(request.url()).pathname;
      if (path === `/api/social/${id}/display`) reads.push(path);
      if (path === `/api/social/${id}/events`) streams.push(path);
    });
    await tv.goto(access.url); await expect(tv.getByText("امسح الرمز وانضم من جوالك")).toBeVisible();
    await expect.poll(() => streams.length).toBe(1);
    await tv.waitForTimeout(31_000);
    await expect(tv.getByText("جارٍ إعادة الاتصال…")).toHaveCount(0);
    await page.getByRole("button", { name: "ابدأ اللعبة" }).click();
    await expect(tv.getByRole("heading", { name: "اطّلعوا على بطاقاتكم" })).toBeVisible();
    expect(streams).toHaveLength(1); expect(reads.length).toBeLessThanOrEqual(1);
  } finally { await close(clients); await tvContext.close(); }
});

test("admin creates, edits and archives secret words", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  await page.goto("/login"); await page.getByLabel("البريد الإلكتروني").fill("admin@example.test");
  await page.getByLabel("كلمة المرور").fill("e2e-admin-password-123");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click(); await expect(page).toHaveURL(/\/games$/);
  await page.goto("/admin/secret-words");
  const created = `كلمة تجربة ${Date.now()}`;
  await page.getByLabel("الكلمة", { exact: true }).fill(created);
  await page.getByRole("button", { name: "حفظ" }).click();
  const row = page.locator(".social-list-item").filter({ hasText: created }); await expect(row).toBeVisible();
  await row.getByRole("button", { name: "تعديل" }).click();
  await page.getByLabel("إجابات بديلة مفصولة بفاصلة").fill("مرادف تجريبي");
  const updated = page.waitForResponse(response => response.url().includes("/api/admin/secret-words/") && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "حفظ" }).click();
  expect((await updated).status()).toBe(200); await expect(page.getByRole("heading", { name: "إضافة كلمة" })).toBeVisible();
  const archived = page.waitForResponse(response => response.url().includes("/api/admin/secret-words/") && response.request().method() === "DELETE");
  await row.getByRole("button", { name: "أرشفة" }).click(); expect((await archived).status()).toBe(200); await expect(row).toContainText("ARCHIVED");
  await page.reload(); await expect(page.locator(".social-list-item").filter({ hasText: created })).toContainText("ARCHIVED");
});

test("host removes a lobby participant; their token and live stream lose access; removal locks at start", async ({ page, browser }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const { id, code } = await hostRoom(page); const clients = await playersJoin(browser, id, code);
  const tvContext = await browser.newContext(); const tv = await tvContext.newPage();
  try {
    const access = await page.evaluate(async id => (await fetch(`/api/social/${id}/display-access`, { method: "POST" })).json(), id);
    await tv.goto(access.url); await expect(tv.getByText("4 لاعب انضموا")).toBeVisible();
    const removed = clients[1];
    expect((await removed.page.request.get(`/api/social/${id}/player`)).status()).toBe(200);
    await page.getByRole("button", { name: "إزالة لاعب 2" }).click();
    await expect(page.getByText("انضم 3 من ١٢")).toBeVisible();
    await expect(tv.getByText("3 لاعب انضموا")).toBeVisible();
    expect((await removed.page.request.get(`/api/social/${id}/player`)).status()).toBe(403);
    await expect(removed.page.getByText("انتهى الوصول إلى العرض أو الغرفة.")).toBeVisible();
    const host = await read(page, id, "host");
    expect(host.participants.map((p: { position: number }) => p.position)).toEqual([0, 1, 2]);
    expect(host.participants.map((p: { name: string }) => p.name)).toEqual(["لاعب 1", "لاعب 3", "لاعب 4"]);
    await page.getByRole("button", { name: "ابدأ اللعبة" }).click();
    await expect(page.getByRole("heading", { name: "وزّعت الأدوار الخاصة" })).toBeVisible();
    const started = await read(page, id, "host");
    const forbidden = await page.request.post(`/api/social/${id}/commands`, { headers: { Origin: "http://127.0.0.1:3000" },
      data: { key: crypto.randomUUID(), expectedVersion: started.version, action: { type: "REMOVE_PARTICIPANT", targetId: started.participants[0].id } } });
    expect(forbidden.status()).toBe(409); expect((await forbidden.json()).code).toBe("INVALID_TRANSITION");
    expect((await read(page, id, "host")).participants).toHaveLength(3);
  } finally { await close(clients); await tvContext.close(); }
});

test("phone conceals the private card after discussion and reveals it briefly on mobile", async ({ page, browser }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const { id, code } = await hostRoom(page); const clients = await playersJoin(browser, id, code, 3);
  try {
    await roles(page, clients, id);
    const normal = clients.find(client => client.role === "PLAYER")!;
    await normal.page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "ابدأ النقاش" }).click();
    const card = normal.page.getByRole("region", { name: "دورك الخاص" });
    await expect(card.getByRole("heading", { name: "بطاقتك مخفية" })).toBeVisible();
    expect(await normal.page.locator("body").innerText()).not.toContain(normal.secretWord!);
    await card.getByRole("button", { name: "إظهار بطاقتي" }).click();
    await expect(card.getByText(normal.secretWord!, { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "إخفاء بطاقتي" }).click();
    await expect(card.getByRole("heading", { name: "بطاقتك مخفية" })).toBeVisible();
    await card.getByRole("button", { name: "إظهار بطاقتي" }).click();
    await expect(card.getByRole("heading", { name: "بطاقتك مخفية" })).toBeVisible({ timeout: 8_000 });
    expect(await normal.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const privateView = await read(normal.page, id, "player");
    expect(privateView.self.secretWord).toBe(normal.secretWord);
  } finally { await close(clients); }
});

test("disconnected outsider times out; late guess fails and expiry resolves once", async ({ page, browser }) => {
  test.setTimeout(90_000);
  test.skip(!process.env.E2E_DATABASE_URL);
  const { id, code } = await hostRoom(page); const clients = await playersJoin(browser, id, code);
  const tvContext = await browser.newContext(); const tv = await tvContext.newPage();
  try {
    await roles(page, clients, id);
    const access = await page.evaluate(async id => (await fetch(`/api/social/${id}/display-access`, { method: "POST" })).json(), id);
    await tv.goto(access.url);
    await discussion(page, clients);
    const outsider = clients.find(client => client.role === "OUTSIDER")!;
    for (const client of clients) {
      const target = client.id === outsider.id ? clients.find(other => other.id !== outsider.id)!.id : outsider.id;
      expect((await vote(client, id, target)).status()).toBe(200);
    }
    await expect(page.getByRole("heading", { name: "انكشف خارج الجو" })).toBeVisible();
    await expect(tv.getByLabel("الوقت المتبقي للتخمين")).toBeVisible();
    const guessing = await read(page, id, "host");
    expect(guessing.phase).toBe("OUTSIDER_GUESS"); expect(guessing.deadlineAt).toBeTruthy();
    expect(new Date(guessing.deadlineAt).getTime() - new Date(guessing.serverNow).getTime()).toBeLessThanOrEqual(30_000);
    await expect(page.getByRole("button", { name: "انتهت مهلة التخمين" })).toBeDisabled();
    const early = await page.request.post(`/api/social/${id}/commands`, { headers: { Origin: "http://127.0.0.1:3000" },
      data: { key: crypto.randomUUID(), expectedVersion: guessing.version, action: { type: "EXPIRE_GUESS" } } });
    expect(early.status()).toBe(409); expect((await early.json()).code).toBe("GUESS_NOT_EXPIRED");
    await outsider.context.setOffline(true);
    await expect(page.getByRole("heading", { name: "فاز اللاعبون!" })).toBeVisible({ timeout: 45_000 });
    await expect(tv.getByRole("heading", { name: "فاز اللاعبون!" })).toBeVisible();
    const result = await read(page, id, "host");
    expect(result.reveal).toMatchObject({ winner: "PLAYERS", reason: "GUESS_TIMEOUT", guess: null });
    await outsider.context.setOffline(false);
    const recovered = await read(outsider.page, id, "player");
    expect(recovered.phase).toBe("RESULTS");
    const late = await outsider.page.request.post(`/api/social/${id}/commands`, { headers: { Origin: "http://127.0.0.1:3000" },
      data: { key: crypto.randomUUID(), expectedVersion: recovered.version, action: { type: "SUBMIT_GUESS", guess: clients.find(c => c.role === "PLAYER")!.secretWord } } });
    expect(late.status()).toBe(409);
    const again = await read(page, id, "host"); expect(again.version).toBe(result.version);
    expect(again.reveal).toMatchObject({ winner: "PLAYERS", reason: "GUESS_TIMEOUT", guess: null });
  } finally { await close(clients); await tvContext.close(); }
});

test("host expiry action succeeds only after the deadline and duplicate command has one result", async ({ page, browser }) => {
  test.setTimeout(90_000);
  test.skip(!process.env.E2E_DATABASE_URL);
  const { id, code } = await hostRoom(page); const clients = await playersJoin(browser, id, code, 3);
  try {
    await roles(page, clients, id); await discussion(page, clients);
    const outsider = clients.find(client => client.role === "OUTSIDER")!;
    for (const client of clients) {
      const target = client.id === outsider.id ? clients.find(other => other.id !== outsider.id)!.id : outsider.id;
      expect((await vote(client, id, target)).status()).toBe(200);
    }
    const guessing = await read(page, id, "host"); expect(guessing.phase).toBe("OUTSIDER_GUESS");
    // Stop all streams so the host command, rather than a live read, settles the expired deadline.
    await Promise.all(clients.map(client => client.page.goto("about:blank")));
    await page.goto("about:blank");
    await page.waitForTimeout(Math.max(0, new Date(guessing.deadlineAt).getTime() - new Date(guessing.serverNow).getTime() + 700));
    const key = crypto.randomUUID(); const payload = { key, expectedVersion: guessing.version, action: { type: "EXPIRE_GUESS" } };
    const first = await page.request.post(`/api/social/${id}/commands`, { headers: { Origin: "http://127.0.0.1:3000" }, data: payload });
    expect(first.status()).toBe(200); expect((await first.json()).duplicate).toBe(false);
    const repeat = await page.request.post(`/api/social/${id}/commands`, { headers: { Origin: "http://127.0.0.1:3000" }, data: payload });
    expect(repeat.status()).toBe(200); expect((await repeat.json()).duplicate).toBe(true);
    const result = await read(page, id, "host"); expect(result.version).toBe(guessing.version + 1);
    expect(result.reveal).toMatchObject({ winner: "PLAYERS", reason: "GUESS_TIMEOUT", guess: null });
  } finally { await close(clients); }
});

test("social TV creation uses the shared active display link limit", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const { id } = await hostRoom(page);
  for (let index = 0; index < 3; index++) {
    const response = await page.evaluate(async id => fetch(`/api/social/${id}/display-access`, { method: "POST" }).then(r => r.status), id);
    expect(response).toBe(200);
  }
  const limit = await page.evaluate(async id => fetch(`/api/social/${id}/display-access`, { method: "POST" }).then(async r => ({ status: r.status, body: await r.json() })), id);
  expect(limit.status).toBe(429); expect(limit.body.error).toContain("حد روابط العرض");
});
