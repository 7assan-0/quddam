import { expect, test } from "@playwright/test";
import { openExistingLegacyLobby } from "./helpers/legacy-fixture";

test("letter battle survives refresh and presents a private question", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL, "Requires migrated database");
  const email = `letters-${Date.now()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("الاسم").fill("مضيف الحروف");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill("letters-password-123");
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await expect(page).toHaveURL(/\/games$/);
  await openExistingLegacyLobby(page, "letter-battle", email);
  await expect(page).toHaveURL(/\/play\/[^/]+$/);
  await page.getByRole("button", { name: "ابدأ المباراة" }).click();
  await expect(page.locator(".letter-cell")).toHaveCount(16);
  await page.locator(".letter-cell").first().click();
  await expect(page.getByRole("button", { name: "احتل الحرف" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "احتل الحرف" })).toBeVisible();
  await page.getByRole("button", { name: "احتل الحرف" }).click();
  await expect(page.getByRole("button", { name: "تراجع عن آخر احتلال" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  const display = await page.context().newPage();
  await display.setViewportSize({ width: 1920, height: 1080 });
  await display.goto(`${new URL(page.url()).pathname}/display`);
  await expect(display.locator(".letter-cell")).toHaveCount(16);
  await expect(display.getByRole("button", { name: "احتل الحرف" })).toHaveCount(0);
  await expect(display.locator("body")).toHaveJSProperty("scrollWidth", 1920);
  await display.close();
});

test("bluff collects submissions, votes and awards scores", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL, "Requires migrated database");
  const email = `bluff-${Date.now()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("الاسم").fill("مضيف الخدعة");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill("bluff-password-123");
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await expect(page).toHaveURL(/\/games$/);
  await openExistingLegacyLobby(page, "bluff", email);
  await page.getByRole("button", { name: "ابدأ المباراة" }).click();
  const player = page.getByLabel("اختر اللاعب");
  for (let i = 0; i < 3; i++) {
    await player.selectOption({ index: i });
    await page.getByLabel("إجابة أو تخمين").fill(`إجابة مختلفة ${i}`);
    await page.getByRole("button", { name: "سجّل الإجابة المموهة" }).click();
    await expect(page.getByText(`${i + 1} من 3 أجابوا`)).toBeVisible();
  }
  await page.getByRole("button", { name: "ابدأ التصويت" }).click();
  for (let i = 0; i < 3; i++) {
    await player.selectOption({ index: i });
    await page.getByLabel("اختر الإجابة").selectOption("correct");
    await page.getByRole("button", { name: "سجّل التصويت" }).click();
    await expect(page.getByText(`${i + 1} من 3 صوتوا`)).toBeVisible();
  }
  await page.getByRole("button", { name: "اعرض النتيجة" }).click();
  await expect(page.getByRole("button", { name: "السؤال التالي" })).toBeVisible();
  await expect(page.locator(".display-team").filter({ hasText: "أحمد" }).locator("strong")).toHaveText("2");
});
