import { expect, test } from "@playwright/test";

test("Arabic landing and account entry points render on desktop and mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: /باقي التحدّي/ })).toBeVisible();
  await page.getByRole("link", { name: "حساب جديد" }).click();
  await expect(page.getByRole("heading", { name: "خلّ لك مكان" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});

test("protected library redirects anonymous visitors and mutation rejects cross origin", async ({ page, request }) => {
  await page.goto("/games");
  await expect(page).toHaveURL(/\/login$/);
  const response = await request.post("/api/auth/register", { data: { name: "Test", email: "test@example.com", password: "a-long-password-123" }, headers: { Origin: "https://untrusted.example" } });
  expect(response.status()).toBe(403);
});

test("account registration, logout and login", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL, "Requires migrated PostgreSQL via E2E_DATABASE_URL");
  const email = `player-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("الاسم").fill("لاعب الاختبار");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill("a-long-password-123");
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.getByRole("heading", { name: /حيّاك يا لاعب الاختبار/ })).toBeVisible();
  await page.getByRole("button", { name: "خروج" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill("a-long-password-123");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(page).toHaveURL(/\/games$/);
});

test("admin can configure welcome credits and grant a registered account", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL, "Requires migrated PostgreSQL via E2E_DATABASE_URL");
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("admin@example.test");
  await page.getByLabel("كلمة المرور").fill("e2e-admin-password-123");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(page).toHaveURL(/\/games$/);
  await page.getByRole("link", { name: "لوحة الإدارة" }).click();
  await page.getByRole("link", { name: "الرصيد", exact: true }).click();
  await page.getByLabel("عدد الألعاب").first().fill("3");
  await page.getByRole("button", { name: "حفظ الإعداد" }).click();
  await expect(page.getByRole("status")).toContainText("حُفظ رصيد البداية");
  await page.reload();
  await expect(page.getByLabel("عدد الألعاب").first()).toHaveValue("3");
  await page.getByLabel("بريد الحساب").fill("player@example.test");
  await page.getByLabel("عدد الألعاب").last().fill("2");
  await page.getByRole("button", { name: "إضافة الرصيد" }).click();
  await expect(page.getByRole("status")).toContainText("الرصيد الحالي: 5");
  await expect(page.getByText("player@example.test")).toBeVisible();
});

test("admin previews CSV, imports questions and configures a product", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL, "Requires migrated PostgreSQL via E2E_DATABASE_URL");
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("admin@example.test");
  await page.getByLabel("كلمة المرور").fill("e2e-admin-password-123");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(page).toHaveURL(/\/games$/);
  await page.goto("/admin/questions");
  const question = `ما اسم عدد الاختبار ${Date.now()}؟`;
  const csv = `gameSlug,categorySlug,question,answer,alternativeAnswers,explanation,difficulty,pointValue,type,options,source,status,language,country,subcategory,imageUrl\ncategory-board,general,${question},واحد,,,EASY,200,TEXT,,محتوى اختبار,DRAFT,ar,,,`;
  await expect(page.locator("#csv-file")).toBeEnabled();
  await page.locator("#csv-file").setInputFiles({ name: "questions.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("questions.csv")).toBeVisible();
  await page.getByRole("button", { name: "معاينة الملف" }).click();
  await expect(page.getByRole("status")).toContainText("1 صالح");
  await page.getByRole("button", { name: "استيراد 1 سؤالًا" }).click();
  await expect(page.getByRole("status")).toContainText("أُضيف 1 سؤالًا");
  await expect(page.getByText(question)).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "تصدير CSV" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("qalba-questions.csv");
  await page.goto("/admin/pricing");
  await page.getByLabel("اسم الباقة").fill("باقة الاختبار");
  await page.getByLabel("رمز الباقة").fill(`test-${Date.now()}`);
  await page.getByLabel("عدد الألعاب").fill("3");
  await page.getByLabel("السعر بالريال").fill("15.50");
  await page.getByRole("button", { name: "حفظ الباقة" }).click();
  await expect(page.getByRole("status")).toContainText("حُفظت البيانات");
  await expect(page.getByText("باقة الاختبار")).toBeVisible();
});
