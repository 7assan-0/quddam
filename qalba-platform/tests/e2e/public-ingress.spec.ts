import { expect, test, type APIRequestContext } from "@playwright/test";
import { request as httpRequest } from "node:http";
import { Pool } from "pg";

const origin = "http://127.0.0.1:3000", password = "e2e-ingress-password-123";
const expectedWelcome = process.env.PUBLIC_WELCOME_CREDITS_ENABLED === "true" ? 3 : 0;
const email = () => `ingress-${crypto.randomUUID()}@example.test`;
const headers = (client = "192.0.2.40") => ({ Origin: origin, "x-quddam-client-ip": client });
async function sql<T>(run: (pool: Pool) => Promise<T>) {
  if (!process.env.E2E_DATABASE_URL) throw new Error("Requires the dedicated E2E database");
  const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 2 });
  try { return await run(pool); } finally { await pool.end(); }
}
async function register(api: APIRequestContext, address: string, client = "192.0.2.40") {
  return api.post("/api/auth/register", { headers: headers(client), data: { name: "مضيف قدّام", email: address, password } });
}
async function wallet(address: string) {
  return sql(async pool => {
    const result = await pool.query('SELECT u.id,w.balance,u.role FROM "User" u JOIN "CreditWallet" w ON w."userId"=u.id WHERE u.email=$1', [address]);
    const user = result.rows[0]; expect(user).toBeTruthy();
    const ledger = await pool.query('SELECT delta FROM "GameCredit" WHERE "idempotencyKey"=$1', [`welcome:${user.id}`]);
    return { ...user, entries: ledger.rows };
  });
}
async function streamedOversize(path: string, limit: number, cookie?: string) {
  return new Promise<{ status: number; bytesSent: number; beforeEnd: boolean }>((resolve, reject) => {
    let done = false;
    const request = httpRequest(new URL(path, origin), { method: "POST", headers: { ...headers(), "content-type": "application/json", "transfer-encoding": "chunked", ...(cookie ? { cookie } : {}) } });
    const timer = setTimeout(() => { if (!done) { done = true; request.destroy(); reject(new Error("No bounded response before streamed EOF")); } }, 10_000);
    request.on("error", error => { if (!done) { done = true; clearTimeout(timer); reject(error); } });
    request.on("response", response => {
      const beforeEnd = !request.writableEnded; response.resume();
      response.on("end", () => { if (!done) { done = true; clearTimeout(timer); resolve({ status: response.statusCode!, bytesSent: limit + 1, beforeEnd }); request.destroy(); } });
    });
    request.write(Buffer.alloc(Math.floor(limit / 2), 32));
    request.write(Buffer.alloc(limit + 1 - Math.floor(limit / 2), 32));
    // Deliberately never end/send the rest: application must reject without full buffering.
  });
}

test.beforeEach(async () => { await sql(pool => pool.query('DELETE FROM "AuthAttempt"')); });

test("M05 legitimate register/login/logout preserves Quddam and one configured welcome grant", async ({ page }) => {
  const address = email();
  await page.context().setExtraHTTPHeaders({ "x-quddam-client-ip": "192.0.2.40" });
  await page.goto("/register"); await expect(page).toHaveTitle(/قدّام/);
  await page.getByLabel("الاسم").fill("مضيف قدّام"); await page.getByLabel("البريد الإلكتروني").fill(address);
  await page.getByLabel("كلمة المرور").fill(password); await page.getByRole("button", { name: "إنشاء الحساب", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.getByRole("link", { name: new RegExp(`رصيدك: ${expectedWelcome} ألعاب`) })).toBeVisible();
  for (let i = 0; i < 3; i++) await page.reload();
  expect(await wallet(address)).toMatchObject({ balance: expectedWelcome, role: "USER", entries: [{ delta: expectedWelcome }] });
  await page.getByRole("button", { name: "خروج", exact: true }).click(); await expect(page).toHaveURL(origin + "/");
  await page.goto("/login"); await page.getByLabel("البريد الإلكتروني").fill(address); await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click(); await expect(page).toHaveURL(/\/games$/);
});

test("M05 parallel registration produces one user, welcome entry and registration event", async ({ request }) => {
  const address = email(); const responses = await Promise.all(Array.from({ length: 8 }, () => register(request, address)));
  expect(responses.filter(r => r.status() === 201)).toHaveLength(1); expect(responses.filter(r => r.status() === 409)).toHaveLength(7);
  const record = await wallet(address); expect(record.balance).toBe(expectedWelcome); expect(record.entries).toEqual([{ delta: expectedWelcome }]);
  await sql(async pool => {
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM "User" WHERE email=$1', [address])).rows[0].count).toBe(1);
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM "AnalyticsEvent" WHERE "userId"=$1 AND name=\'USER_REGISTERED\'', [record.id])).rows[0].count).toBe(1);
  });
  expect((await register(request, address)).status()).toBe(429);
});

test("M05 household burst works; rotating emails hit client limit while another client is isolated", async ({ request }) => {
  for (let i = 0; i < 4; i++) expect((await register(request, email(), "192.0.2.41")).status()).toBe(201);
  for (let i = 4; i < 12; i++) expect((await register(request, email(), "192.0.2.41")).status()).toBe(201);
  expect((await register(request, email(), "192.0.2.41")).status()).toBe(429);
  expect((await register(request, email(), "192.0.2.42")).status()).toBe(201);
});

test("M05 login budget recovers and does not email-lock a victim on another client", async ({ request }) => {
  const address = email(); expect((await register(request, address)).status()).toBe(201);
  for (let i = 0; i < 8; i++) expect((await request.post("/api/auth/login", { headers: headers("192.0.2.43"), data: { email: address, password: "incorrect" } })).status()).toBe(401);
  expect((await request.post("/api/auth/login", { headers: headers("192.0.2.43"), data: { email: address, password } })).status()).toBe(429);
  expect((await request.post("/api/auth/login", { headers: headers("192.0.2.44"), data: { email: address, password } })).status()).toBe(200);
  // Deterministic fixture aging; no 15-minute sleep or production clock modification.
  await sql(pool => pool.query('UPDATE "AuthAttempt" SET "windowStart"=$1::timestamp', [new Date(Date.now() - 16 * 60_000).toISOString()]));
  expect((await request.post("/api/auth/login", { headers: headers("192.0.2.43"), data: { email: address, password } })).status()).toBe(200);
});

test("M05 real reset mail flow is bounded, recovers and preserves one-use session invalidation", async ({ page }) => {
  const address = email(); expect((await register(page.request, address)).status()).toBe(201);
  for (let i = 0; i < 3; i++) expect((await page.request.post("/api/auth/forgot", { headers: headers(), data: { email: address } })).status()).toBe(200);
  expect((await page.request.post("/api/auth/forgot", { headers: headers(), data: { email: address } })).status()).toBe(200);
  const record = await wallet(address);
  await sql(async pool => { expect((await pool.query('SELECT COUNT(*)::int AS count FROM "PasswordReset" WHERE "userId"=$1', [record.id])).rows[0].count).toBe(3); });
  const mailbox = await (await fetch(`http://127.0.0.1:2528/latest?to=${encodeURIComponent(address)}`)).json() as { url: string };
  expect(new URL(mailbox.url).pathname).toBe("/reset-password");
  const token = new URL(mailbox.url).searchParams.get("token")!;
  await page.goto(mailbox.url); await page.getByLabel("كلمة المرور", { exact: true }).fill("reset-new-password-123");
  await page.getByRole("button", { name: "حفظ كلمة المرور", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("تم تحديث كلمة المرور. يمكنك الدخول الآن.");
  await page.getByRole("link", { name: "العودة لتسجيل الدخول", exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.post("/api/auth/reset", { headers: headers(), data: { token, password: "reset-new-password-123" } })).status()).toBe(400);
  await sql(async pool => { expect((await pool.query('SELECT COUNT(*)::int AS count FROM "AuthSession" WHERE "userId"=$1 AND "revokedAt" IS NULL', [record.id])).rows[0].count).toBe(0); });
  await sql(pool => pool.query('UPDATE "AuthAttempt" SET "windowStart"=$1::timestamp', [new Date(Date.now() - 16 * 60_000).toISOString()]));
  expect((await page.request.post("/api/auth/forgot", { headers: headers(), data: { email: address } })).status()).toBe(200);
  await sql(async pool => { expect((await pool.query('SELECT COUNT(*)::int AS count FROM "PasswordReset" WHERE "userId"=$1', [record.id])).rows[0].count).toBe(4); });
  expect((await page.request.post("/api/auth/login", { headers: headers(), data: { email: address, password: "reset-new-password-123" } })).status()).toBe(200);
});

test("M05 authoritative admin login has a stricter, client-isolated boundary", async ({ request }) => {
  for (let i = 0; i < 5; i++) expect((await request.post("/api/auth/login", { headers: headers("192.0.2.45"), data: { email: "admin@example.test", password: "incorrect" } })).status()).toBe(401);
  expect((await request.post("/api/auth/login", { headers: headers("192.0.2.45"), data: { email: "admin@example.test", password: "e2e-admin-password-123" } })).status()).toBe(429);
  expect((await request.post("/api/auth/login", { headers: headers("192.0.2.46"), data: { email: "admin@example.test", password: "e2e-admin-password-123" } })).status()).toBe(200);
});

test("M04 small/exact-boundary Arabic JSON succeeds and declared oversized JSON returns 413", async ({ request }) => {
  const data = { name: "قدّام عربي", email: email(), password };
  const small = JSON.stringify(data); const exact = small + " ".repeat(16_384 - Buffer.byteLength(small));
  expect(Buffer.byteLength(exact)).toBe(16_384);
  expect((await request.post("/api/auth/register", { headers: { ...headers(), "content-type": "application/json" }, data: exact })).status()).toBe(201);
  expect((await request.post("/api/auth/register", { headers: headers(), data: " ".repeat(16_385) })).status()).toBe(413);
  expect((await request.post("/api/auth/register", { headers: headers(), data: "{" })).status()).toBe(400);
});

test("M04 streamed request is rejected before EOF without Content-Length", async ({ baseURL }, info) => {
  expect(baseURL).toBe(origin);
  const result = await streamedOversize("/api/auth/register", 16_384);
  expect(result.status).toBe(413); expect(result.beforeEnd).toBe(true);
  await info.attach("stream-stop", { body: JSON.stringify(result), contentType: "application/json" });
});

test("M04 billing callback rejects a streamed oversized payload before financial lookup", async ({ request }, info) => {
  const token = process.env.MOYASAR_CALLBACK_TOKEN!; expect(token.length).toBeGreaterThanOrEqual(32);
  const before = await sql(pool => pool.query('SELECT COUNT(*)::int AS count FROM "Purchase"'));
  const result = await streamedOversize(`/api/billing/callback?token=${token}`, 16_384); expect(result.status).toBe(413); expect(result.beforeEnd).toBe(true);
  expect((await request.post("/api/billing/callback?token=invalid", { data: " ".repeat(16_385) })).status()).toBe(403);
  const after = await sql(pool => pool.query('SELECT COUNT(*)::int AS count FROM "Purchase"')); expect(after.rows).toEqual(before.rows);
  await info.attach("callback-stream-stop", { body: JSON.stringify(result), contentType: "application/json" });
});

test("M04 admin CSV import remains usable and oversized stream is bounded", async ({ page }, info) => {
  expect((await page.request.post("/api/auth/login", { headers: headers(), data: { email: "admin@example.test", password: "e2e-admin-password-123" } })).status()).toBe(200);
  await page.goto("/admin/questions"); await expect(page).toHaveTitle(/قدّام/);
  const question = `سؤال استيراد قدّام ${crypto.randomUUID()}؟`;
  const csv = `gameSlug,categorySlug,question,answer,alternativeAnswers,explanation,difficulty,pointValue,type,options,source,status,language,country,subcategory,imageUrl\ncategory-board,general,${question},واحد,,,EASY,200,TEXT,,محتوى اختبار,DRAFT,ar,,,`;
  await page.locator("#csv-file").setInputFiles({ name: "ingress.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "معاينة الملف", exact: true }).click(); await expect(page.getByRole("status")).toContainText("1 صالح");
  await page.getByRole("button", { name: "استيراد 1 سؤالًا", exact: true }).click(); await expect(page.getByRole("status")).toContainText("أُضيف 1 سؤالًا");
  const cookie = (await page.context().cookies()).map(c => `${c.name}=${c.value}`).join("; ");
  const result = await streamedOversize("/api/admin/questions/import", 550_000, cookie); expect(result.status).toBe(413); expect(result.beforeEnd).toBe(true);
  await info.attach("import-stream-stop", { body: JSON.stringify(result), contentType: "application/json" });
});
