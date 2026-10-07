import { expect, test, type Page } from "@playwright/test";

async function startBoard(page: Page, names: [string, string] = ["فريق الزمرد", "فريق المرجان"]) {
  await page.goto("/register");
  await page.getByLabel("الاسم").fill("مضيف الاختبار");
  await page.getByLabel("البريد الإلكتروني").fill(`hardening-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`);
  await page.getByLabel("كلمة المرور").fill("hardening-password-12345");
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await page.getByRole("link", { name: "ابدأ لوحة التحدي" }).click();
  await page.getByLabel("الفريق الأول").fill(names[0]);
  await page.getByLabel("الفريق الثاني").fill(names[1]);
  const categories = page.getByRole("checkbox");
  for (let i = 0; i < 6; i++) await categories.nth(i).check();
  await page.getByRole("button", { name: "جهّز اللوحة" }).click();
  await expect(page).toHaveURL(/\/play\/[^/]+$/);
  const sessionId = page.url().split("/").at(-1)!;
  await page.getByRole("button", { name: "ابدأ المباراة" }).click();
  await page.getByRole("button", { name: "معلومات عامة 200" }).click();
  return sessionId;
}

test("wrong → pause → resume → undo restores the original question and team", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  await startBoard(page);
  await page.getByRole("button", { name: /خطأ/ }).click();
  await expect(page.getByText("فرصة السرقة", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "إيقاف المباراة مؤقتًا" }).click();
  await page.getByRole("button", { name: "استئناف المباراة" }).click();
  await page.getByRole("button", { name: "تراجع عن آخر إجراء" }).click();
  await expect(page.getByText("دور فريق الزمرد", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "معلومات عامة 200" })).toBeDisabled();
  await page.reload();
  await expect(page.getByText("دور فريق الزمرد", { exact: true })).toBeVisible();
});

test("pause freezes the server timer across refresh and display token is read-only", async ({ page, browser }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const sessionId = await startBoard(page);
  await page.getByRole("button", { name: "شغّل المؤقت" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "إيقاف المباراة مؤقتًا" }).click();
  const saved = await page.locator(".question-timer span").innerText();
  await page.waitForTimeout(2200);
  await page.reload();
  await expect(page.locator(".question-timer span")).toHaveText(saved);
  await page.getByRole("button", { name: "استئناف المباراة" }).click();
  await expect(page.locator(".question-timer span")).not.toHaveText(saved, { timeout: 4000 });

  const access = await page.evaluate(async (id) => {
    const response = await fetch(`/api/games/category-board/${id}/display-access`, { method: "POST" });
    return response.json();
  }, sessionId);
  const tvContext = await browser.newContext();
  const tv = await tvContext.newPage();
  expect((await tvContext.request.get(`/api/display/${sessionId}?token=invalid`)).status()).toBe(403);
  const requests: string[] = [];
  tv.on("request", (request) => { if (request.url().includes(`/api/display/${sessionId}`)) requests.push(request.url()); });
  await tv.goto(access.url);
  await expect(tv.locator(".display-question h1")).toBeVisible();
  const denied = await tvContext.request.post(`/api/games/category-board/${sessionId}/commands?token=${new URL(access.url, "http://127.0.0.1:3000").searchParams.get("token")}`, {
    data: { key: crypto.randomUUID(), expectedVersion: 0, action: { type: "CORRECT" } },
    headers: { Origin: "http://127.0.0.1:3000" },
  });
  expect(denied.status()).toBe(403);
  await page.getByRole("button", { name: "اكشف الإجابة" }).click();
  await expect(tv.locator(".display-answer")).toBeVisible();
  await page.getByRole("button", { name: "إعادة الوقت" }).click();
  await page.getByRole("button", { name: /صحيح/ }).click();
  await expect(tv.locator(".display-team").filter({ hasText: "فريق الزمرد" })).toContainText("200");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "إنهاء المباراة" }).click();
  await expect(tv.getByRole("heading", { name: "الفائز: فريق الزمرد" })).toBeVisible();
  const completedCount = requests.length;
  await tv.waitForTimeout(3200);
  expect(requests.length).toBe(completedCount);
  const revoked = await page.evaluate(async (sessionId) => (await fetch(`/api/games/category-board/${sessionId}/display-access`, { method: "DELETE" })).status, sessionId);
  expect(revoked).toBe(200);
  expect((await tvContext.request.get(`/api/display/${sessionId}?token=${new URL(access.url, "http://127.0.0.1:3000").searchParams.get("token")}`)).status()).toBe(403);
  await tvContext.close();
});

test("configured team order is kept in the scoreboard, TV, and rematch", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const id = await startBoard(page, ["فريق ياقوت", "فريق ألف"]);
  await expect(page.locator(".team-score").first()).toContainText("فريق ياقوت");
  const view = await (await page.request.get(`/api/games/category-board/${id}`)).json();
  expect(view.teams.map((team: { name: string; position: number }) => [team.name, team.position])).toEqual([
    ["فريق ياقوت", 0], ["فريق ألف", 1],
  ]);
  await page.getByRole("button", { name: "فتح شاشة العرض" }).click();
  const [display] = await Promise.all([page.context().waitForEvent("page"), page.getByRole("dialog", { name: "شاشة العرض" }).getByRole("button", { name: "فتح العرض في هذا الجهاز" }).click()]);
  await expect(display.locator(".display-team").first()).toContainText("فريق ياقوت");
  await page.goto(`/games/category-board/new?rematch=${id}`);
  await expect(page.getByLabel("الفريق الأول")).toHaveValue("فريق ياقوت");
  await expect(page.getByLabel("الفريق الثاني")).toHaveValue("فريق ألف");
  await display.close();
});

test("duplicate and stale commands cannot double-score or complete a cell twice", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const id = await startBoard(page);
  const result = await page.evaluate(async (sessionId) => {
    const view = await (await fetch(`/api/games/category-board/${sessionId}`)).json();
    const key = crypto.randomUUID();
    const send = (action: unknown, commandKey = crypto.randomUUID()) => fetch(`/api/games/category-board/${sessionId}/commands`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: commandKey, expectedVersion: view.version, action }),
    });
    const first = await send({ type: "CORRECT" }, key);
    const retry = await send({ type: "CORRECT" }, key);
    const stale = await send({ type: "WRONG" });
    const reuse = await send({ type: "WRONG" }, key);
    const after = await (await fetch(`/api/games/category-board/${sessionId}`)).json();
    return { first: first.status, retry: retry.status, duplicate: (await retry.json()).duplicate,
      stale: (await stale.json()).code, reuse: (await reuse.json()).code, score: after.teams[0].score,
      completed: after.cells.filter((cell: { completed: boolean }) => cell.completed).length };
  }, id);
  expect(result).toEqual({ first: 200, retry: 200, duplicate: true, stale: "STALE_GAME_STATE",
    reuse: "COMMAND_KEY_REUSED", score: 200, completed: 1 });
  await page.reload();
  await page.getByRole("button", { name: "السعودية 200" }).click();
  const concurrent = await page.evaluate(async (sessionId) => {
    const view = await (await fetch(`/api/games/category-board/${sessionId}`)).json();
    const action = (type: "CORRECT" | "WRONG") => fetch(`/api/games/category-board/${sessionId}/commands`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: crypto.randomUUID(), expectedVersion: view.version, action: { type } }),
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
    const responses = await Promise.all([action("CORRECT"), action("WRONG")]);
    const after = await (await fetch(`/api/games/category-board/${sessionId}`)).json();
    return { statuses: responses.map((item) => item.status).sort(), version: after.version,
      score: after.teams.reduce((sum: number, team: { score: number }) => sum + team.score, 0),
      completed: after.cells.filter((cell: { completed: boolean }) => cell.completed).length };
  }, id);
  expect(concurrent.statuses).toEqual([200, 409]);
  expect(concurrent.completed).toBe(1 + (concurrent.score === 400 ? 1 : 0));
});

test("simultaneous identical keys execute once, while a different payload reusing the key is rejected", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const id = await startBoard(page);
  const result = await page.evaluate(async (sessionId) => {
    const read = () => fetch(`/api/games/category-board/${sessionId}`).then((response) => response.json());
    const before = await read();
    const key = crypto.randomUUID();
    const request = (action: { type: string; slug?: string }, commandKey: string, version: number) =>
      fetch(`/api/games/category-board/${sessionId}/commands`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: commandKey, expectedVersion: version, action }) })
        .then(async (response) => ({ status: response.status, body: await response.json() }));
    const same = await Promise.all([request({ type: "CORRECT" }, key, before.version), request({ type: "CORRECT" }, key, before.version)]);
    const after = await read();
    return { statuses: same.map((entry) => entry.status), duplicates: same.map((entry) => entry.body.duplicate).sort(),
      version: after.version, beforeVersion: before.version, score: after.teams[0].score,
      completed: after.cells.filter((cell: { completed: boolean }) => cell.completed).length };
  }, id);
  expect(result.statuses).toEqual([200, 200]);
  expect(result.duplicates).toEqual([false, true]);
  expect(result.version).toBe(result.beforeVersion + 1);
  expect(result.score).toBe(200);
  expect(result.completed).toBe(1);

  await page.reload();
  await page.getByRole("button", { name: "السعودية 200" }).click();
  const power = await page.evaluate(async (sessionId) => {
    const read = () => fetch(`/api/games/category-board/${sessionId}`).then((response) => response.json());
    const before = await read();
    const teamId = before.active.answeringTeamId;
    const prior = before.powerUps.find((entry: { slug: string; teamId: string }) => entry.slug === "double" && entry.teamId === teamId).remaining;
    const key = crypto.randomUUID();
    const send = (action: unknown) => fetch(`/api/games/category-board/${sessionId}/commands`, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, expectedVersion: before.version, action }) })
      .then(async (response) => ({ status: response.status, body: await response.json() }));
    const results = await Promise.all([send({ type: "USE_POWERUP", slug: "double" }), send({ type: "USE_POWERUP", slug: "double" })]);
    const after = await read();
    const remaining = after.powerUps.find((entry: { slug: string; teamId: string }) => entry.slug === "double" && entry.teamId === teamId).remaining;
    const mixedKey = crypto.randomUUID();
    const sendMixed = (action: unknown) => fetch(`/api/games/category-board/${sessionId}/commands`, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: mixedKey, expectedVersion: after.version, action }) })
      .then(async (response) => ({ status: response.status, body: await response.json() }));
    const changed = await Promise.all([sendMixed({ type: "CORRECT" }), sendMixed({ type: "USE_POWERUP", slug: "shield" })]);
    return { statuses: results.map((entry) => entry.status), duplicates: results.map((entry) => entry.body.duplicate).sort(),
      versionDelta: after.version - before.version, powerDelta: prior - remaining, doubled: after.active.double,
      changedStatuses: changed.map((entry) => entry.status).sort(), changedCode: changed.find((entry) => entry.status === 409)?.body.code };
  }, id);
  expect(power).toMatchObject({ statuses: [200, 200], duplicates: [false, true], versionDelta: 1,
    powerDelta: 1, doubled: true, changedStatuses: [200, 409], changedCode: "COMMAND_KEY_REUSED" });
});

test("TV remains connected beyond 30 seconds and receives later updates without fallback polling", async ({ page, browser }) => {
  test.setTimeout(95_000);
  test.skip(!process.env.E2E_DATABASE_URL);
  const id = await startBoard(page);
  const link = await page.evaluate(async (sessionId) => (await fetch(`/api/games/category-board/${sessionId}/display-access`, { method: "POST" })).json(), id);
  const context = await browser.newContext();
  const tv = await context.newPage();
  const stateReads: string[] = [];
  const streams: string[] = [];
  tv.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === `/api/display/${id}`) stateReads.push(request.url());
    if (path === `/api/display/${id}/events`) streams.push(request.url());
  });
  await tv.goto(link.url);
  await expect(tv.locator(".display-question h1")).toBeVisible();
  await expect.poll(() => streams.length).toBe(1);
  await tv.waitForTimeout(32_000);
  await expect(tv.getByText("جارٍ إعادة الاتصال بشاشة العرض…")).toHaveCount(0);
  await page.getByRole("button", { name: "اكشف الإجابة" }).click();
  await expect(tv.locator(".display-answer")).toBeVisible();
  expect(streams).toHaveLength(1);
  expect(stateReads.length).toBeLessThanOrEqual(1);
  await context.close();
});

test("host hands off a scannable link, copies it, and can revoke after refresh", async ({ page, browser }) => {
  test.skip(!process.env.E2E_DATABASE_URL);
  const id = await startBoard(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "فتح شاشة العرض" }).click();
  const modal = page.getByRole("dialog", { name: "شاشة العرض" });
  await expect(modal).toBeVisible();
  await expect(modal.getByText(/تنتهي صلاحية الرابط/)).toBeVisible();
  await expect(modal.getByRole("img", { name: "رمز QR لرابط شاشة العرض" })).toHaveAttribute("src", /^data:image\/png;base64,/);
  expect(await modal.getByRole("img").evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await modal.getByRole("button", { name: "نسخ رابط العرض" }).click();
  await expect(modal.getByRole("status")).toHaveText("تم نسخ رابط العرض");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(copied).pathname).toBe(`/display/${id}`);
  expect(new URL(copied).searchParams.get("token")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const tvContext = await browser.newContext();
  const tv = await tvContext.newPage();
  await tv.goto(copied);
  await expect(tv.locator(".display-question h1")).toBeVisible();
  await modal.getByRole("button", { name: "إغلاق" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "إلغاء رابط العرض" })).toBeVisible();
  const view = await (await page.request.get(`/api/games/category-board/${id}`)).json();
  expect(view.displayAccess.active).toBe(true);
  expect(JSON.stringify(view.displayAccess)).not.toContain(new URL(copied).searchParams.get("token"));
  await page.getByRole("button", { name: "إلغاء رابط العرض" }).click();
  await expect(page.getByRole("button", { name: "إلغاء رابط العرض" })).toHaveCount(0);
  expect((await tvContext.request.get(`/api/display/${id}?token=${new URL(copied).searchParams.get("token")}`)).status()).toBe(403);
  await tv.reload();
  await expect(tv.locator(".display-question")).toHaveCount(0);
  await tvContext.close();
});
