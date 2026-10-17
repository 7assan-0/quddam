import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool, type QueryResultRow } from "pg";
import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import type { getBoardSession } from "../../src/lib/games/category-board/service";
import type { roomView } from "../../src/lib/rooms/service";

export type BoardView = Awaited<ReturnType<typeof getBoardSession>>;
export type RoomView = Awaited<ReturnType<typeof roomView>>;

function guardedConnection() {
  const path = process.env.E2E_NATIVE_PG17_FIXTURE;
  if (!path) throw new Error("Category Board native acceptance requires its explicit private synthetic fixture");
  const fixture = JSON.parse(readFileSync(path, "utf8")) as { databaseUrl: string; synthetic: boolean; purpose: string; expectedDatabase: string; expectedUser: string; expectedPort: number; expectedSystemIdentifier: string; fixtureId: string };
  const url = new URL(fixture.databaseUrl);
  if (!fixture.synthetic || fixture.purpose !== "quddam-pr17-category-board" || url.hostname !== "127.0.0.1" ||
      url.port !== String(fixture.expectedPort) || url.pathname !== `/${fixture.expectedDatabase}` ||
      fixture.databaseUrl !== process.env.E2E_DATABASE_URL)
    throw new Error("Acceptance database differs from the isolated fixture");
  return fixture;
}

async function verifiedPool() {
  const fixture = guardedConnection();
  const pool = new Pool({ connectionString: fixture.databaseUrl, max: 3 });
  try {
    const actual = (await pool.query(`SELECT current_database() AS database, current_user AS role,
      current_setting('server_version_num')::int AS version,
      (SELECT system_identifier::text FROM pg_control_system()) AS identity`)).rows[0];
    expect(actual.database).toBe(fixture.expectedDatabase); expect(actual.role).toBe(fixture.expectedUser);
    expect(actual.identity).toBe(fixture.expectedSystemIdentifier);
    expect(actual.version).toBeGreaterThanOrEqual(170000); expect(actual.version).toBeLessThan(180000);
    const marker = (await pool.query("SELECT fixture_id,purpose,state FROM quddam_e2e_fixture.identity")).rows;
    expect(marker).toEqual([{ fixture_id: fixture.fixtureId, purpose: fixture.purpose, state: "READY" }]);
    return pool;
  } catch (error) { await pool.end(); throw error; }
}

/** Acceptance reads only. The DB runner owns provisioning; this helper cannot seed or mutate it. */
export async function inspectDatabase<T extends QueryResultRow>(query: string, values: unknown[] = []) {
  if (!/^SELECT\b/i.test(query.trim())) throw new Error("Acceptance database inspection must be read-only");
  const pool = await verifiedPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const version = await client.query<{ version: number }>("SELECT current_setting('server_version_num')::int AS version");
    if (version.rows[0].version < 170000 || version.rows[0].version >= 180000)
      throw new Error("This acceptance requires native PostgreSQL 17");
    const result = await client.query<T>(query, values);
    await client.query("COMMIT");
    return result.rows;
  } finally {
    client.release();
    await pool.end();
  }
}

/** A row lock only, rolled back on failure; never changes scores, results or credits.
 * Observe two independently blocked application backends before releasing them.
 */
export async function behindSessionLock<T>(id: string, run: () => Promise<T>) {
  const pool = await verifiedPool(), gate = await pool.connect();
  let pending: Promise<T> | undefined;
  try {
    await gate.query("BEGIN");
    const target = await gate.query('SELECT id FROM "GameSession" WHERE id=$1 FOR UPDATE', [id]);
    expect(target.rowCount).toBe(1);
    const pid = (await gate.query("SELECT pg_backend_pid() AS pid")).rows[0].pid as number;
    pending = run(); void pending.catch(() => {});
    await expect.poll(async () => {
      const waiting = await pool.query("SELECT DISTINCT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND pid<>$1", [pid]);
      return waiting.rowCount;
    }, { timeout: 15000 }).toBe(2);
    await gate.query("COMMIT");
    return { result: await pending, evidence: { independentBackends: 3, observedBlocked: 2 } };
  } finally {
    await gate.query("ROLLBACK").catch(() => {});
    if (pending) await pending.catch(() => {});
    gate.release(); await pool.end();
  }
}

export async function readBoard(page: Page, id: string): Promise<BoardView> {
  const response = await page.request.get(`/api/games/category-board/${id}`);
  expect(response.status(), "Owner board read must succeed").toBe(200);
  return response.json();
}

export async function readRoom(page: Page, code: string): Promise<RoomView> {
  const response = await page.request.get(`/api/rooms/${code}`);
  expect(response.status(), "Authorized room read must succeed").toBe(200);
  return response.json();
}

export async function createBoardRoom(page: Page, prefix: string) {
  const email = `${prefix}-${randomUUID()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("الاسم", { exact: true }).fill("مضيف قبول لوحة التحدي");
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill("board-acceptance-password-12345");
  await page.getByRole("button", { name: "إنشاء الحساب", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  await page.getByRole("link", { name: "ابدأ لوحة التحدي", exact: true }).click();
  await expect(page).toHaveURL(/\/games\/category-board\/new$/, { timeout: 15000 });
  const categories = page.getByRole("checkbox");
  await expect(categories.nth(5)).toBeVisible({ timeout: 15000 });
  expect(await categories.count()).toBeGreaterThanOrEqual(6);
  for (let index = 0; index < 6; index++) await categories.nth(index).check();
  await page.getByLabel("ثواني السؤال", { exact: true }).selectOption("60");
  // Approved branding adds “يلا قدّام ·” to the accessible action name.
  await page.getByRole("button", { name: /جهّز اللوحة$/ }).click();
  await expect(page).toHaveURL(/\/play\/[^/]+$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("button", { name: "أنشئ غرفة برمز", exact: true }).click();
  const code = (await page.locator(".room-code").innerText()).trim();
  expect(code, "Room code format").toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  const board = await readBoard(page, id);
  expect(board.cells).toHaveLength(72);
  expect(new Set(board.cells.map(cell => cell.key)).size).toBe(72);
  expect(board.teams).toHaveLength(2);
  return { id, code, board, email };
}

export async function mobileGuest(browser: Browser, host: Page, code: string, name: string, teamId: string) {
  const context = await browser.newContext({
    baseURL: new URL(host.url()).origin,
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`/join?code=${code}`);
  await page.getByLabel("اسمك في اللعب", { exact: true }).fill(name);
  await page.getByLabel("فريقك", { exact: true }).selectOption(teamId);
  const admitted = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/rooms/${code}/join`);
  await page.getByRole("button", { name: "انضم إلى الغرفة", exact: true }).click();
  expect((await admitted).status(), "A guest must be admitted by the real backend").toBe(201);
  await expect(page).toHaveURL(new RegExp(`/rooms/${code}$`));
  await page.getByRole("button", { name: "أنا جاهز", exact: true }).click();
  await expect(page.getByRole("button", { name: "إلغاء الجاهزية", exact: true })).toBeEnabled();
  return { context, page };
}

/** Wait for the actual UI command response, rather than racing the next assertion against React. */
export async function hostAction(page: Page, id: string, control: Locator, type: string) {
  const response = page.waitForResponse(response => {
    if (response.request().method() !== "POST" || new URL(response.url()).pathname !== `/api/games/category-board/${id}/commands`) return false;
    return response.request().postDataJSON()?.action?.type === type;
  });
  await expect(control).toBeEnabled();
  await control.click();
  const actual = await response;
  expect(actual.status(), `Real UI ${type} command must succeed`).toBe(200);
  const result = await actual.json() as { session: BoardView; duplicate: boolean };
  return { ...result, request: actual.request().postDataJSON() as { key: string; expectedVersion: number; action: object } };
}

export function cellControl(page: Page, board: BoardView, cell: BoardView['cells'][number]) {
  const category = board.categories.find(category => category.id === cell.categoryId)!;
  const slot = board.cells.filter(item => item.categoryId === cell.categoryId && item.value === cell.value)
    .findIndex(item => item.key === cell.key) + 1;
  const accessibleName = `${category.title} ${cell.value}${slot > 1 ? ` سؤال ${slot}` : ""}`;
  return page.getByRole("button", { name: accessibleName, exact: true });
}

export async function assertScores(page: Page, selector: string, scores: number[]) {
  await expect.poll(async () => page.locator(selector).allTextContents()).toEqual(scores.map(String));
}
