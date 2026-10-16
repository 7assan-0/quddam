import { expect, test } from "@playwright/test";

/**
 * Beta acceptance: a host and five independent mobile browser contexts share
 * one authoritative Category Board room. Requires a migrated, seeded, isolated
 * E2E_DATABASE_URL. No production data or public network is used.
 */
test("five mobile guests join, reconnect and observe host-authoritative scoring", async ({ browser, page }) => {
  test.skip(!process.env.E2E_DATABASE_URL, "Requires isolated migrated PostgreSQL via E2E_DATABASE_URL");
  test.setTimeout(120_000);
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
  try {
    await page.goto("/register");
    await page.getByLabel("الاسم").fill("مضيف قبول البيتا");
    await page.getByLabel("البريد الإلكتروني").fill(`board-beta-${Date.now()}@example.test`);
    await page.getByLabel("كلمة المرور").fill("board-beta-password-12345");
    await page.getByRole("button", { name: "إنشاء الحساب" }).click();
    await page.getByRole("link", { name: "ابدأ لوحة التحدي" }).click();
    const categories = page.getByRole("checkbox");
    await expect(categories).toHaveCount(6);
    for (let i = 0; i < 6; i++) await categories.nth(i).check();
    await page.getByRole("button", { name: "جهّز اللوحة" }).click();
    await page.getByRole("button", { name: "أنشئ غرفة برمز" }).click();
    const code = (await page.locator(".room-code").innerText()).trim();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const guests = [];
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      contexts.push(context);
      const guest = await context.newPage();
      await guest.goto(`/join?code=${code}`);
      await guest.getByLabel("اسمك في اللعب").fill(`ضيف البيتا ${i + 1}`);
      await guest.getByRole("button", { name: "انضم إلى الغرفة" }).click();
      await expect(guest).toHaveURL(new RegExp(`/rooms/${code}$`));
      await guest.getByRole("button", { name: "أنا جاهز" }).click();
      guests.push(guest);
    }
    await expect(page.getByText("5 لاعب في الغرفة · 5 جاهزون")).toBeVisible();
    await guests[2].reload();
    await expect(guests[2]).toHaveURL(new RegExp(`/rooms/${code}$`));
    await expect(page.getByText("5 لاعب في الغرفة · 5 جاهزون")).toBeVisible();

    await page.getByRole("button", { name: "ابدأ المباراة" }).click();
    await page.getByRole("button", { name: "معلومات عامة 200" }).click();
    for (const guest of guests) {
      await expect(guest.locator(".room-question h2")).toBeVisible();
      await expect(guest.getByRole("button", { name: /صحيح/ })).toHaveCount(0);
      await expect(guest.locator("body")).toHaveJSProperty("scrollWidth", 390);
    }
    await guests[0].getByLabel("إجابتك للمضيف").fill("إجابة اختبار من الجوال");
    await guests[0].getByRole("button", { name: "أرسل" }).click();
    await expect(page.getByText("ضيف البيتا 1: إجابة اختبار من الجوال")).toBeVisible();
    await guests[0].reload();
    await expect(guests[0].getByRole("button", { name: "وصلت إجابتك" })).toBeDisabled();

    await page.getByRole("button", { name: "اكشف الإجابة" }).click();
    for (const guest of guests) await expect(guest.locator(".answer-reveal")).toBeVisible();
    await page.getByRole("button", { name: /صحيح/ }).click();
    await expect(page.getByRole("button", { name: "معلومات عامة 200 مستخدم" })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole("button", { name: "معلومات عامة 200 مستخدم" })).toBeDisabled();
    for (const guest of guests) await expect(guest.getByRole("button", { name: /صحيح/ })).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
