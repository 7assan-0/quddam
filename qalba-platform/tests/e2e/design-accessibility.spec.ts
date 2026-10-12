import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const axePath = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");

async function checkA11y(page: Page, name: string) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (options: unknown) => Promise<{ violations: Array<{ id: string; impact: string; nodes: Array<{ target: string[] }> }> }> } }).axe;
    const result = await axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return result.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target.join(" ")) }));
  });
  expect(violations, `${name}: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
}

test("critical screens meet automated WCAG A/AA checks", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL, "Requires seeded PostgreSQL");
  for (const [name, route] of [["landing", "/"], ["login", "/login"], ["register", "/register"], ["room join", "/join"]] as const) {
    await page.goto(route);
    await checkA11y(page, name);
  }
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("admin@example.test");
  await page.getByLabel("كلمة المرور").fill("e2e-admin-password-123");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(page).toHaveURL(/\/games$/);
  await checkA11y(page, "games library");
  await page.goto("/admin");
  await checkA11y(page, "admin");
  await page.goto("/games/category-board/new");
  const categories = page.getByRole("checkbox");
  for (let i = 0; i < 6; i++) await categories.nth(i).check();
  await page.getByRole("button", { name: "جهّز اللوحة" }).click();
  await expect(page).toHaveURL(/\/play\/[^/]+$/);
  await page.getByRole("button", { name: "ابدأ المباراة" }).click();
  await checkA11y(page, "Category Board host");
  await page.getByRole("button", { name: "فتح شاشة العرض" }).click();
  await checkA11y(page, "TV handoff dialog");
  await page.getByRole("dialog", { name: "شاشة العرض" }).getByRole("button", { name: "إغلاق" }).click();
  const id = new URL(page.url()).pathname.split("/").at(-1);
  const access = await (await page.request.post(`/api/games/category-board/${id}/display-access`, {
    headers: { Origin: "http://127.0.0.1:3000" },
  })).json();
  const display = await page.context().newPage();
  await display.goto(access.url);
  await checkA11y(display, "TV display");
  await display.close();
});

test("six viewports, long Arabic content, four team tokens, focus and reduced motion", async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(!process.env.E2E_DATABASE_URL, "Requires seeded PostgreSQL");
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("admin@example.test");
  await page.getByLabel("كلمة المرور").fill("e2e-admin-password-123");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(page).toHaveURL(/\/games$/);
  await page.goto("/games/category-board/new");
  const categories = page.getByRole("checkbox");
  for (let i = 0; i < 6; i++) await categories.nth(i).check();
  await page.getByRole("button", { name: "جهّز اللوحة" }).click();
  await page.getByRole("button", { name: "ابدأ المباراة" }).click();
  await page.getByRole("button", { name: "معلومات عامة 200" }).click();
  const sessionId = new URL(page.url()).pathname.split("/").at(-1);
  const access = await (await page.request.post(`/api/games/category-board/${sessionId}/display-access`, {
    headers: { Origin: "http://127.0.0.1:3000" },
  })).json();
  const display = await page.context().newPage();
  await display.goto(access.url);
  await display.waitForTimeout(300);
  await display.evaluate(() => {
    document.querySelectorAll(".display-team span")[0].textContent = "فريق الأصدقاء أصحاب الاسم الطويل جدًا في هذه الجولة الممتعة";
    document.querySelectorAll(".display-team span")[1].textContent = "فريق المنافسين المتحمسين من كل أنحاء المجلس";
    document.querySelector(".display-column h2")!.textContent = "المعلومات العامة والموضوعات الممتدة للاختبار";
    document.querySelector(".display-question h1")!.textContent = "في مساء جمعة اجتمع الأصدقاء حول الشاشة، وتناقشوا عن المدن والبحار والعلوم؛ ما اسم البحر الذي يمتد بمحاذاة الساحل الغربي للمملكة العربية السعودية من الشمال إلى الجنوب؟";
  });
  await expect(display.getByRole("heading", { name: /في مساء جمعة/ })).toBeVisible({ timeout: 10_000 });
  expect((await display.request.get("/fonts/NotoSansArabic-Regular.ttf")).status()).toBe(200);
  expect(await display.evaluate(() => document.fonts.check('400 16px "Qalba Arabic"', "مرحبًا"))).toBe(true);

  for (const [width, height] of [[360,800],[390,844],[768,1024],[1440,900],[1920,1080],[3840,2160]] as const) {
    await display.setViewportSize({ width, height });
    await display.evaluate(() => document.fonts.ready);
    const dimensions = await display.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth, board: document.querySelector(".display-grid")?.getBoundingClientRect().bottom ?? 0,
      question: document.querySelector(".display-question h1")?.getBoundingClientRect().toJSON(),
      panel: document.querySelector(".display-center")?.getBoundingClientRect().toJSON() }));
    expect(dimensions.document, `${width}x${height} document overflow`).toBeLessThanOrEqual(width);
    expect(dimensions.body, `${width}x${height} body overflow`).toBeLessThanOrEqual(width);
    if (width >= 1920) expect(dimensions.board, `${width}x${height} TV board height`).toBeLessThanOrEqual(height);
    expect(dimensions.question!.left, `${width} question left`).toBeGreaterThanOrEqual(dimensions.panel!.left);
    expect(dimensions.question!.right, `${width} question right`).toBeLessThanOrEqual(dimensions.panel!.right);
    if (process.env.CAPTURE_QA) await display.screenshot({ path: `/tmp/qalba-hardening-${width}x${height}.png`, fullPage: true });
  }
  await display.setViewportSize({ width: 1920, height: 1080 });
  const active = display.locator(".display-team--active");
  await expect(active.getByText("الدور الآن")).toBeVisible();
  expect(await active.evaluate((element) => getComputedStyle(element).outlineColor)).toBe("rgb(25, 227, 209)");
  const teamColors = await display.evaluate(() => ["--team-a", "--team-b", "--team-c", "--team-d"].map((token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim()));
  expect(new Set(teamColors).size).toBe(4);
  await display.keyboard.press("Tab");
  const focus = await display.evaluate(() => ({ tag: document.activeElement?.tagName, outline: getComputedStyle(document.activeElement!).outlineStyle }));
  expect(focus).toEqual({ tag: "BUTTON", outline: "solid" });
  await display.emulateMedia({ reducedMotion: "reduce" });
  expect(await display.locator(".display-team--active").evaluate((element) => getComputedStyle(element).animationDuration)).toBe("1e-05s");
  await display.close();
});
