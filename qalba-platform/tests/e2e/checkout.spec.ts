import { expect, test } from "@playwright/test";

test("priced product comes from admin database and checkout waits for configured gateway", async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL, "Requires migrated database");
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("admin@example.test");
  await page.getByLabel("كلمة المرور").fill("e2e-admin-password-123");
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/games$/);
  const product = await page.request.post("/api/admin/products", { data: { slug: `party-${Date.now()}`, title: "باقة جمعة اختبارية", credits: 5, priceHalalas: 1750, active: true }, headers: { Origin: "http://127.0.0.1:3000" } });
  expect(product.status()).toBe(201);
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "باقة جمعة اختبارية" })).toBeVisible();
  await expect(page.getByText(new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(17.5))).toBeVisible();
  await expect(page.getByRole("button", { name: "شراء الرصيد" })).toBeDisabled();
  await expect(page.getByText("الدفع بانتظار تهيئة بوابة المزود.")).toBeVisible();
  const unavailable = await page.request.post("/api/billing/checkout", { data: { productId: (await product.json()).id, key: crypto.randomUUID() }, headers: { Origin: "http://127.0.0.1:3000" } });
  expect(unavailable.status()).toBe(503);
});
