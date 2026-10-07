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


import{writeFileSync}from'node:fs';
test('J2 Social touch geometry (diagnostic, not a canonical identity)',async({page,browser})=>{const{id,code}=await hostRoom(page),clients=await playersJoin(browser,id,code);try{await roles(page,clients,id);await page.getByRole('button',{name:'ابدأ النقاش'}).click();const phone=clients[0].page;await phone.setViewportSize({width:390,height:844});await expect(phone.getByRole('button',{name:'إظهار بطاقتي',exact:true})).toBeVisible();const controls=await phone.locator('.social-player button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{surface:'social-player',width:r.width,height:r.height,minHeight:getComputedStyle(e).minHeight,disabled:(e as HTMLButtonElement).disabled}}));expect(controls.length).toBeGreaterThan(0);for(const c of controls){expect(c.width).toBeGreaterThanOrEqual(44);expect(c.height).toBeGreaterThanOrEqual(44);}writeFileSync(process.env.J2_GEOMETRY!,JSON.stringify({productionBuild:true,canonicalIdentity:false,viewport:{width:390,height:844},controls},null,2));}finally{await close(clients);}});