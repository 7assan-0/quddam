import { expect, test } from "@playwright/test";
test("security headers, private analytics and payment hooks reject public access", async ({ page }) => {
  const landing = await page.goto("/");
  expect(landing?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(landing?.headers()["x-frame-options"]).toBe("DENY");
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "كيف نتعامل مع البيانات" })).toBeVisible();
  const callback = await page.request.post("/api/billing/callback?token=bad", { data: { id: crypto.randomUUID() } });
  expect(callback.status()).toBe(403);
  const prune = await page.request.post("/api/analytics/prune");
  expect(prune.status()).toBe(403);
  const reconcile = await page.request.post("/api/billing/reconcile");
  expect(reconcile.status()).toBe(403);
  await page.goto("/admin/analytics");
  await expect(page).toHaveURL(/\/login$/);
});
