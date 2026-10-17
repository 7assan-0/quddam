import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/** Real Chromium measurements, scoped to the presentation-only PR. No mocked CSS. */
const axePath = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");
type Evidence = { screen: string; viewport: number; contrast: Array<{ selector: string; summary: string }>;
  touch: Array<{ element: string; width: number; height: number }> };

async function measure(page: Page, screen: string, viewport: number): Promise<Evidence> {
  await page.addScriptTag({ path: axePath });
  const contrast = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: unknown, options: unknown) =>
      Promise<{ violations: Array<{ id: string; nodes: Array<{ target: string[]; failureSummary?: string }> }> }> } }).axe;
    const result = await axe.run(document, { runOnly: { type: "rule", values: ["color-contrast"] } });
    return result.violations.flatMap(violation => violation.nodes.map(node => ({
      selector: node.target.join(" "), summary: node.failureSummary ?? violation.id,
    })));
  });
  const touch = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(
    "button, a.btn, summary, [role='button'], .category-option"
  )).filter(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 &&
      !element.closest("[inert]") && !element.matches(":disabled");
  }).map(element => {
    const rect = element.getBoundingClientRect();
    return { element: `${element.tagName.toLowerCase()}${element.className && typeof element.className === "string" ? "." + element.className.trim().replace(/\s+/g, ".") : ""} ${element.textContent?.trim().slice(0, 45) ?? ""}`,
      width: Math.round(rect.width * 100) / 100, height: Math.round(rect.height * 100) / 100 };
  }).filter(element => element.width < 44 || element.height < 44));
  return { screen, viewport, contrast, touch };
}

test("PR25: measured AA text contrast and 44px interactive targets on 360/390 mobile", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(!process.env.E2E_DATABASE_URL, "Requires the isolated synthetic database");
  const evidence: Evidence[] = [];
  const visit = async (screen: string, route: string, viewport: number) => {
    await page.setViewportSize({ width: viewport, height: 844 });
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    // The drawer links have to be measured while visible, not silently excluded.
    const menu = page.locator(".mobile-menu > summary");
    if (await menu.isVisible()) await menu.click();
    evidence.push(await measure(page, screen, viewport));
  };
  for (const width of [360, 390]) await visit("public home", "/", width);
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("admin@example.test");
  await page.getByLabel("كلمة المرور").fill("e2e-admin-password-123");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(page).toHaveURL(/\/games$/);
  for (const width of [360, 390]) {
    await visit("signed-in library", "/games", width);
    await visit("Shillatak empty/setup", "/shillatak", width);
    await visit("Category Board setup", "/games/category-board/new", width);
    await visit("Night entry", "/night", width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/games/category-board/new");
  const categories = page.getByRole("checkbox");
  for (let i = 0; i < 6; i++) await categories.nth(i).check();
  await page.getByRole("button", { name: "جهّز اللوحة" }).click();
  await expect(page).toHaveURL(/\/play\/[^/]+$/);
  await page.getByRole("button", { name: "ابدأ المباراة" }).click();
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => document.fonts.ready);
    const menu = page.locator(".mobile-menu > summary");
    if (await menu.isVisible() && !(await page.locator(".mobile-menu").getAttribute("open"))) await menu.click();
    evidence.push(await measure(page, "Category Board host", width));
  }
  await testInfo.attach("pr25-accessibility-measurements.json", {
    body: JSON.stringify({ sourceSha: process.env.GITHUB_SHA ?? "local", evidence }, null, 2),
    contentType: "application/json",
  });
  const failures = evidence.flatMap(e => [
    ...e.contrast.map(item => `${e.screen} ${e.viewport}px contrast: ${item.selector}: ${item.summary}`),
    ...e.touch.map(item => `${e.screen} ${e.viewport}px target: ${item.element}: ${item.width}x${item.height}px`),
  ]);
  expect(failures, failures.join("\n")).toEqual([]);
});
