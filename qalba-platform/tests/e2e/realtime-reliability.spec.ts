import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
const origin = 'http://127.0.0.1:3000';
type Probe = { events: string[]; versions: number[]; done: boolean; stop: () => void };
declare global { interface Window { d1Probes: Probe[] } }
async function sql(text: string, values: unknown[] = []) { const p = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 1 }); try { return await p.query(text, values); } finally { await p.end(); } }
async function register(page: Page) {
 expect(process.env.E2E_DATABASE_URL).toBeTruthy();
 const r = await page.request.post('/api/auth/register', { headers: { Origin: origin }, data: { name: 'مضيف اتصال', email: `d1-${randomUUID()}@example.test`, password: 'd1-reliability-password' } }); expect(r.status(), await r.text()).toBe(201);
}
async function create(page: Page, game: 'lightning' | 'ordering') {
 await register(page); const r = await page.request.post(`/api/${game}`, { headers: { Origin: origin }, data: { teams: ['فريق مرجان', 'فريق بحر'] } }); expect(r.status(), await r.text()).toBe(201); const id = (await r.json()).id as string;
 await command(page.request, game, id, 'START'); await command(page.request, game, id, game === 'lightning' ? 'PREPARE_QUESTION' : 'START_ROUND'); return id;
}
async function command(api: APIRequestContext, game: string, id: string, type: string) {
 const v = await (await api.get(`/api/${game}/${id}`)).json(); const r = await api.post(`/api/${game}/${id}/commands`, { headers: { Origin: origin }, data: { key: randomUUID(), expectedVersion: v.version, action: { type } } }); expect(r.status(), await r.text()).toBe(200); return (await r.json()).session;
}
async function probe(page: Page, path: string) {
 const index = await page.evaluate(path => {
  const abort = new AbortController(), p: Probe = { events: [], versions: [], done: false, stop: () => abort.abort() };
  window.d1Probes ??= []; const index = window.d1Probes.push(p) - 1;
  void (async () => {
   try {
    const r = await fetch(path, { signal: abort.signal }); if (!r.ok) { p.events.push(`http-${r.status}`); return; }
    const reader = r.body!.getReader(), decoder = new TextDecoder(); let pending = '';
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; pending += decoder.decode(chunk.value, { stream: true }); let boundary: number;
     while ((boundary = pending.indexOf('\n\n')) >= 0) { const event = pending.slice(0, boundary); pending = pending.slice(boundary + 2); const name = event.match(/event: ([^\n]+)/)?.[1]; if (name) p.events.push(name); if (name === 'state') p.versions.push(JSON.parse(event.split('data: ')[1]).version); }
    }
   } catch { /* deliberate abort / transport loss */ } finally { p.done = true; }
  })(); return index;
 }, path);
 await expect.poll(() => page.evaluate(i => window.d1Probes[i].versions.length, index), { timeout: 15_000 }).toBeGreaterThan(0); return index;
}
test('D1: real PostgreSQL read failure is retryable and Lightning recovers without reload', async ({ page }, info) => {
 test.setTimeout(90_000); const id = await create(page, 'lightning'); await page.goto(`/lightning/host/${id}`); await expect(page.locator('.lightning-host')).toHaveAttribute('data-live-ready', 'true');
 const p = await probe(page, `/api/lightning/${id}/events?audience=host`);
 let renamed = false;
 try {
  // Isolated native test database only: a real failed query, no application error flag or production change.
  await sql('ALTER TABLE "GameSession" RENAME TO "D1_GameSession_Unavailable"'); renamed = true;
  await expect.poll(() => page.evaluate(i => window.d1Probes[i].events, p)).toContain('connection-error');
  expect(await page.evaluate(i => window.d1Probes[i].events, p)).not.toContain('access-ended');
  await expect(page.getByText('إعادة الاتصال…', { exact: true })).toBeVisible();
 } finally { if (renamed) await sql('ALTER TABLE "D1_GameSession_Unavailable" RENAME TO "GameSession"'); }
 await expect(page.getByText('إعادة الاتصال…', { exact: true })).not.toBeVisible({ timeout: 20_000 });
 await expect(page.locator('.lightning-host')).toHaveAttribute('data-live-ready', 'true');
 const v = await command(page.request, 'lightning', id, 'OPEN_BUZZ'); await expect(page.locator('.lightning-host')).toHaveAttribute('data-phase', 'BUZZ_OPEN');
 await info.attach('D1-native-transient-recovery', { body: JSON.stringify({ nativeQueryFailure: true, terminalEvent: false, recoveredWithoutReload: true, continuedVersion: v.version }), contentType: 'application/json' });
});
test('D1: Ordering fallback backs off and stops after SSE recovery', async ({ page }, info) => {
 test.setTimeout(90_000); const id = await create(page, 'ordering'), attempts: number[] = [];
 const eventPattern = `**/api/ordering/${id}/events?*`, viewPattern = `**/api/ordering/${id}`;
 await page.route(eventPattern, r => r.abort());
 await page.route(viewPattern, async r => { attempts.push(Date.now()); if (attempts.length <= 2) await r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"synthetic temporary failure"}' }); else await r.continue(); });
 await page.goto(`/ordering/host/${id}`);
 await expect.poll(() => attempts.length, { timeout: 20_000 }).toBe(2); expect(attempts[1] - attempts[0]).toBeGreaterThanOrEqual(5500);
 expect(await page.getByText('انتهى الوصول إلى المباراة أو الرابط.', { exact: true }).count()).toBe(0);
 await page.unroute(eventPattern); await expect(page.locator('.ordering-host')).toHaveAttribute('data-live-ready', 'true', { timeout: 20_000 });
 await expect(page.getByText('إعادة الاتصال…', { exact: true })).not.toBeVisible();
 const recoveredCalls = attempts.length; await page.waitForTimeout(5000); expect(attempts.length).toBe(recoveredCalls);
 await command(page.request, 'ordering', id, 'PAUSE'); await expect(page.locator('.ordering-host')).toHaveAttribute('data-phase', 'PAUSED');
 await info.attach('D1-fallback-evidence', { body: JSON.stringify({ firstFailureSpacingMs: attempts[1] - attempts[0], stoppedAfterRecovery: true, recoveredWithoutReload: true }), contentType: 'application/json' });
});
test('D1: same credential fan-out is bounded; Host TV buzzer isolation and abort release work', async ({ page }, info) => {
 const id = await create(page, 'lightning'); await page.goto('/games');
 const h1 = await probe(page, `/api/lightning/${id}/events?audience=host`); await probe(page, `/api/lightning/${id}/events?audience=host`);
 const excess = await page.request.get(`/api/lightning/${id}/events?audience=host`); expect(excess.status()).toBe(429); expect(excess.headers()['retry-after']).toBe('5');
 const view = await (await page.request.get(`/api/lightning/${id}`)).json();
 const d = await page.request.post(`/api/lightning/${id}/display-access`, { headers: { Origin: origin } }), b = await page.request.post(`/api/lightning/${id}/buzzer-access`, { headers: { Origin: origin }, data: { teamId: view.teams[0].id } }); expect(d.status()).toBe(200); expect(b.status()).toBe(200);
 const display = await d.json(), buzzer = await b.json();
 const displayToken = new URL(display.url).searchParams.get("token"), buzzerToken = new URL(buzzer.url).searchParams.get("token");
 await probe(page, `/api/lightning/${id}/events?audience=display&token=${displayToken}`); await probe(page, `/api/lightning/${id}/events?audience=buzzer&token=${buzzerToken}`);
 await page.evaluate(i => window.d1Probes[i].stop(), h1); await expect.poll(() => page.evaluate(i => window.d1Probes[i].done, h1)).toBe(true); await page.waitForTimeout(500);
 await probe(page, `/api/lightning/${id}/events?audience=host`);
 await info.attach('D1-fanout-evidence', { body: JSON.stringify({ hostLimit: 2, thirdStatus: 429, separateDisplayAndBuzzerAllowed: true, abortReleasedSlot: true, enforcement: 'per server process' }), contentType: 'application/json' });
 await page.evaluate(() => window.d1Probes.forEach(p => p.stop()));
});
test('D1: authoritative missing session ends stream and clears Host answer', async ({ page }) => {
 const id = await create(page, 'lightning'), v = await (await page.request.get(`/api/lightning/${id}`)).json(), answer = v.privateAnswer.answer as string;
 await page.goto(`/lightning/host/${id}`); await expect(page.locator('.lightning-host')).toHaveAttribute('data-live-ready', 'true'); expect(await page.locator('body').innerText()).toContain(answer);
 await sql('DELETE FROM "GameSession" WHERE "id"=$1', [id]);
 await expect(page.getByText('انتهى الوصول إلى المباراة أو الرابط.', { exact: true })).toBeVisible(); expect(await page.locator('body').innerText()).not.toContain(answer);
});
test('D1: expired Social participant stream clears the already displayed secret', async ({ page, browser }, info) => {
 await register(page); const created = await page.request.post('/api/social', { headers: { Origin: origin }, data: { timerSeconds: 60 } }); expect(created.status()).toBe(201); const room = await created.json();
 const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext()));
 try {
  for (const [i, context] of contexts.entries()) { const r = await context.request.post(`${origin}/api/social/${room.id}/join`, { headers: { Origin: origin }, data: { code: room.code, name: `مشارك اتصال ${i}` } }); expect(r.status()).toBe(201); }
  await command(page.request, 'social', room.id, 'START');
  const views = await Promise.all(contexts.map(async c => (await c.request.get(`${origin}/api/social/${room.id}/player`)).json())); const index = views.findIndex(v => v.self.secretWord); expect(index).toBeGreaterThanOrEqual(0);
  const participant = await contexts[index].newPage(); await participant.goto(`${origin}/social/play/${room.id}`);
  // The existing role-card disclosure UI decides when to show it; transport assertions also check the private projection.
  const secret = views[index].self.secretWord as string;
  const reveal = participant.getByRole('button', { name: /شوف|أظهر|اكشف|عرض|بطاق/ }).first(); if (await reveal.count()) await reveal.click();
  await expect(participant.locator('body')).toContainText(secret);
  await sql('UPDATE "Room" SET "expiresAt"=(now() AT TIME ZONE \'UTC\')-interval \'1 second\' WHERE "sessionId"=$1', [room.id]);
  await expect(participant.getByText('انتهى الوصول إلى العرض أو الغرفة.', { exact: true })).toBeVisible(); expect(await participant.locator('body').innerText()).not.toContain(secret);
  await info.attach('D1-social-secret-clearing', { body: JSON.stringify({ secretInitiallyVisible: true, expiredRoomTerminal: true, secretCleared: true }), contentType: 'application/json' });
 } finally { for (const c of contexts) await c.close(); }
});
