import { expect, test } from "@playwright/test";

/** One synthetic match proves both same-value tiles are separate. No production database. */
test("six categories show six playable tiles each and a 36-question match does not repeat a tile", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL, "Requires isolated seeded E2E_DATABASE_URL");
  const email = `board-36-${Date.now()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("الاسم").fill("مضيف لوحة ٣٦");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill("board-36-password-12345");
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await page.getByRole("link", { name: "ابدأ لوحة التحدي" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(6);
  for (let i = 0; i < 6; i++) await page.getByRole("checkbox").nth(i).check();
  await page.getByRole("button", { name: /جهّز اللوحة$/ }).click();
  await expect(page).toHaveURL(/\/play\/[^/]+$/);
  const id = page.url().split("/").at(-1)!;
  const response = await page.request.get(`/api/games/category-board/${id}`);
  expect(response.status()).toBe(200);
  let board = await response.json();
  expect(board.cells).toHaveLength(36);
  expect(new Set(board.cells.map((cell: { key: string }) => cell.key)).size).toBe(36);
  for (const category of board.categories) {
    const tiles = board.cells.filter((cell: { categoryId: string }) => cell.categoryId === category.id);
    expect(tiles).toHaveLength(6);
    for (const value of [200, 400, 600])
      expect(tiles.filter((cell: { value: number }) => cell.value === value)).toHaveLength(2);
  }
  await page.getByRole("button", { name: "ابدأ المباراة", exact: true }).click();
  await expect(page.locator(".board-column")).toHaveCount(6);
  await expect(page.locator(".board-cell")).toHaveCount(36);
  await page.getByRole("button", { name: "معلومات عامة 200", exact: true }).click();
  board = await (await page.request.get(`/api/games/category-board/${id}`)).json();
  const first = board.active.questionId;
  await page.getByRole("button", { name: "اكشف الإجابة" }).click();
  await page.getByRole("button", { name: /^صحيح/ }).click();
  await expect(page.getByRole("button", { name: "معلومات عامة 200 مستخدم", exact: true })).toBeDisabled();
  const second = page.getByRole("button", { name: "سؤال 2 · معلومات عامة · 200 نقطة", exact: true });
  await expect(second).toBeEnabled();
  await second.click();
  board = await (await page.request.get(`/api/games/category-board/${id}`)).json();
  expect(board.active.questionId).not.toBe(first);
  expect(board.status).toBe("IN_PROGRESS");
  expect(board.cells.filter((cell: { completed: boolean }) => cell.completed)).toHaveLength(1);
});
