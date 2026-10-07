import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { test, expect, type Page, type Browser, type BrowserContext } from '@playwright/test';
import type { RankedView } from '../../src/lib/games/ranked/service';
import type { SocialView } from '../../src/lib/games/social-deduction/service';
const origin = 'http://127.0.0.1:3000';
async function sql(text: string, values: unknown[] = []) { const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 2 }); try { return await pool.query(text, values); } finally { await pool.end(); } }
async function register(page: Page) { expect(process.env.E2E_DATABASE_URL).toBeTruthy(); const r = await page.request.post('/api/auth/register', { headers: { Origin: origin }, data: { name: 'مضيف النوايا', email: `d2-${randomUUID()}@example.test`, password: 'd2-intent-test-password' } }); expect(r.status(), await r.text()).toBe(201); }
async function read<T>(page: Page, game: 'ranked' | 'social', id: string, player = false): Promise<T> { const r = await page.request.get(`/api/${game}/${id}${player ? '/player' : ''}`); expect(r.status(), await r.text()).toBe(200); return r.json(); }
async function command(page: Page, game: 'ranked' | 'social', id: string, type: string) { const v = await read<{ version: number }>(page, game, id); const r = await page.request.post(`/api/${game}/${id}/commands`, { headers: { Origin: origin }, data: { key: randomUUID(), expectedVersion: v.version, action: { type } } }); expect(r.status(), await r.text()).toBe(200); return (await r.json()).session; }
async function rankedRoom(page: Page) {
 await register(page); const created = await page.request.post('/api/ranked', { headers: { Origin: origin }, data: { teams: ['فريق مرجان', 'فريق بحر'] } }); expect(created.status()).toBe(201); const id = (await created.json()).id as string;
 await command(page, 'ranked', id, 'START'); await command(page, 'ranked', id, 'START_ROUND');
 // Disposable fixture deadline avoids compiler/test pacing consuming the real 20-second turn.
 await sql('UPDATE "GameSession" SET "state"=jsonb_set("state",\'{deadlineAt}\',to_jsonb($2::bigint)) WHERE "id"=$1', [id, Date.now() + 120000]);
 await page.addInitScript(() => {
  const NativeSource = window.EventSource;
  const state = { freeze: false, version: -1, match: 0, round: 0, sources: [] as EventSource[] };
  Object.assign(window, { d2Realtime: state });
  window.EventSource = class extends NativeSource {
   constructor(url: string | URL, init?: EventSourceInit) {
    super(url, init); state.sources.push(this); const add = this.addEventListener.bind(this);
    this.addEventListener = ((type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
     if (type !== 'state') return add(type, callback, options);
     add(type, event => { if (state.freeze) return; if (typeof callback === 'function') callback.call(this, event); else callback.handleEvent(event); const view = JSON.parse((event as MessageEvent).data); state.version = view.version; state.match = view.matchNumber; state.round = view.roundNumber; }, options);
    }) as EventSource['addEventListener'];
   }
  };
 });
 await page.goto(`/ranked/host/${id}`); await expect(page.locator('.ranked-host')).toHaveAttribute('data-live-ready', 'true'); return id;
}
type RankedWire = { key: string; expectedVersion: number; action: { type: string; guess: string } };
async function sendGuess(page: Page, text: string) { await page.getByLabel('تخمين الفريق الحالي', { exact: true }).fill(text); await page.getByRole('button', { name: 'أرسل التخمين', exact: true }).click(); }
function realtime(page: Page) { return page.evaluate(() => (window as unknown as { d2Realtime: { version: number; match: number; round: number } }).d2Realtime); }
test('D2 M08: lost commit response retries the same unresolved key and awards once', async ({ page }, info) => {
 const id = await rankedRoom(page), v = await read<RankedView>(page, 'ranked', id), entries = (await sql('SELECT u."snapshot" FROM "RankedListUse" u JOIN "GameSession" s ON u."id"=s."state"->\'useIds\'->>0 WHERE s."id"=$1', [id])).rows[0].snapshot.entries;
 await page.evaluate(() => { (window as unknown as { d2Realtime: { freeze: boolean } }).d2Realtime.freeze = true; });
 const wires: RankedWire[] = []; const replies: boolean[] = [];
 await page.route(`**/api/ranked/${id}/commands`, async route => { wires.push(route.request().postDataJSON()); const response = await route.fetch(); expect(response.status()).toBe(200); replies.push((await response.json()).duplicate); if (wires.length === 1) await route.abort('failed'); else await route.fulfill({ response }); });
 await sendGuess(page, entries[0].answer); await expect(page.locator('.form-error[role="alert"]')).toBeVisible();
 await page.getByRole('button', { name: 'أرسل التخمين', exact: true }).click(); await expect(page.getByLabel('تخمين الفريق الحالي', { exact: true })).toHaveValue('');
 expect(wires).toHaveLength(2); expect(wires[1]).toEqual(wires[0]); expect(replies).toEqual([false, true]); expect(wires[0].expectedVersion).toBe(v.version);
 const current = await read<RankedView>(page, 'ranked', id); expect(current.version).toBe(v.version + 1); expect(current.attempts).toEqual([1, 0]);
 const ledger = (await sql('SELECT "delta" FROM "ScoreEvent" WHERE "sessionId"=$1', [id])).rows; expect(ledger).toEqual([{ delta: entries[0].points }]); expect((await sql('SELECT count(*)::int n FROM "GameCommand" WHERE "sessionId"=$1 AND "key"=$2', [id, wires[0].key])).rows[0].n).toBe(1);
 await info.attach('M08-lost-response', { body: JSON.stringify({ sameKey: true, sameExpectedVersion: true, duplicates: replies, oneScoreEvent: true, oneAttempt: true, noReload: true }), contentType: 'application/json' });
});
test('D2 M08: authoritative fallback progress invalidates old key; SSE recovery stops polling', async ({ page }, info) => {
 test.setTimeout(90000); const id = await rankedRoom(page), before = await read<RankedView>(page, 'ranked', id), wires: RankedWire[] = []; let reads = 0;
 const events = `**/api/ranked/${id}/events?*`; await page.route(events, route => route.abort());
 await page.route(`**/api/ranked/${id}`, async route => { reads++; await route.continue(); });
 await page.evaluate(() => { const s = (window as unknown as { d2Realtime: { sources: EventSource[] } }).d2Realtime.sources.at(-1)!; s.dispatchEvent(new Event('error')); });
 await page.route(`**/api/ranked/${id}/commands`, async route => { wires.push(route.request().postDataJSON()); const response = await route.fetch(); expect(response.status()).toBe(200); if (wires.length === 1) await route.abort('failed'); else await route.fulfill({ response }); });
 await sendGuess(page, 'تخمين غير موجود إطلاقاً'); await expect(page.locator('.form-error[role="alert"]')).toBeVisible();
 await expect.poll(() => reads, { timeout: 15000 }).toBeGreaterThan(0);
 // The host UI's active team is updated by the fallback, not a manual reload.
 await expect(page.locator('.ranked-active')).toHaveAttribute('aria-label', `الفريق ب: ${before.teams[1].name}`);
 await page.getByRole('button', { name: 'أرسل التخمين', exact: true }).click(); await expect(page.getByLabel('تخمين الفريق الحالي', { exact: true })).toHaveValue('');
 expect(wires).toHaveLength(2); expect(wires[1].key).not.toBe(wires[0].key); expect(wires[1].expectedVersion).toBe(before.version + 1);
 expect((await read<RankedView>(page, 'ranked', id)).attempts).toEqual([1, 1]);
 await page.unroute(events); await expect(page.getByText('جارٍ إعادة الاتصال…', { exact: true })).not.toBeVisible({ timeout: 20000 });
 await expect.poll(async () => (await realtime(page)).version, { timeout: 35000 }).toBeGreaterThanOrEqual(before.version + 2);
 const recoveredReads = reads; await page.waitForTimeout(4000); expect(reads).toBe(recoveredReads); expect((await sql('SELECT count(*)::int n FROM "ScoreEvent" WHERE "sessionId"=$1', [id])).rows[0].n).toBe(0);
 await info.attach('M08-D1-fallback', { body: JSON.stringify({ newKeyAfterFallback: true, expectedVersionAdvanced: true, attempts: [1, 1], healthySSEStoppedPolling: true, noReload: true }), contentType: 'application/json' });
});
test('D2 M08: later round and rematch identical actions get fresh keys', async ({ page }, info) => {
 test.setTimeout(120000); const id = await rankedRoom(page), wires: RankedWire[] = [];
 await page.route(`**/api/ranked/${id}/commands`, async route => { wires.push(route.request().postDataJSON()); const response = await route.fetch(); expect(response.status()).toBe(200); await route.abort('failed'); });
 await sendGuess(page, 'تخمين غير موجود إطلاقاً'); await expect(page.locator('.form-error[role="alert"]')).toBeVisible();
 await command(page, 'ranked', id, 'END_ROUND'); await command(page, 'ranked', id, 'NEXT_ROUND'); await command(page, 'ranked', id, 'START_ROUND');
 let v = await read<RankedView>(page, 'ranked', id); await expect.poll(async () => (await realtime(page)).version).toBe(v.version); expect((await realtime(page)).round).toBe(2);
 await sendGuess(page, 'تخمين غير موجود إطلاقاً'); await expect.poll(() => wires.length).toBe(2); await expect(page.getByRole('button', { name: 'أرسل التخمين', exact: true })).toBeEnabled(); expect(wires[1].key).not.toBe(wires[0].key); expect(wires[1].expectedVersion).toBe(v.version);
 // Close each original round through unchanged authoritative commands.
 for (let round = 2; round <= 5; round++) { await command(page, 'ranked', id, 'END_ROUND'); await command(page, 'ranked', id, 'NEXT_ROUND'); if (round < 5) await command(page, 'ranked', id, 'START_ROUND'); }
 await command(page, 'ranked', id, 'COMPLETE'); await command(page, 'ranked', id, 'REMATCH'); await command(page, 'ranked', id, 'START_ROUND');
 v = await read<RankedView>(page, 'ranked', id); await expect.poll(async () => (await realtime(page)).version).toBe(v.version); expect((await realtime(page)).match).toBe(2);
 await sendGuess(page, 'تخمين غير موجود إطلاقاً'); await expect.poll(() => wires.length).toBe(3); expect(new Set(wires.map(w => w.key)).size).toBe(3); expect(wires[2].expectedVersion).toBe(v.version);
 expect((await read<RankedView>(page, 'ranked', id)).attempts).toEqual([1, 0]); expect((await sql('SELECT count(*)::int n FROM "ScoreEvent" WHERE "sessionId"=$1', [id])).rows[0].n).toBe(0);
 await info.attach('M08-new-boundaries', { body: JSON.stringify({ uniqueKeys: 3, laterRound: 2, rematch: 2, oneAttemptAfterRematch: true, noReload: true }), contentType: 'application/json' });
});
type SocialPhone = { context: BrowserContext; page: Page; id: string; name: string };
async function socialRoom(page: Page, browser: Browser) {
 await register(page); const r = await page.request.post('/api/social', { headers: { Origin: origin }, data: { timerSeconds: 60 } }); expect(r.status()).toBe(201); const room = await r.json(); const phones: SocialPhone[] = [];
 for (let i = 0; i < 3; i++) { const context = await browser.newContext(), phone = await context.newPage(), name = `مشارك الجولة ${i + 1}`; const joined = await context.request.post(`${origin}/api/social/${room.id}/join`, { headers: { Origin: origin }, data: { code: room.code, name } }); expect(joined.status()).toBe(201); const view = await read<SocialView>(phone, 'social', room.id, true); phones.push({ context, page: phone, name, id: view.self!.id }); }
 await command(page, 'social', room.id, 'START'); await socialVoting(page, room.id); for (const p of phones) { await p.page.goto(`${origin}/social/play/${room.id}`); await expect(p.page.getByRole('heading', { name: 'مين خارج الجو؟' })).toBeVisible(); } return { id: room.id as string, phones };
}
async function socialVoting(page: Page, id: string) { await command(page, 'social', id, 'BEGIN_DISCUSSION'); await command(page, 'social', id, 'BEGIN_VOTING'); }
async function socialInvariant(id: string) {
 const session = (await sql('SELECT row_to_json(s) AS data FROM "GameSession" s WHERE "id"=$1', [id])).rows;
 const commands = (await sql('SELECT row_to_json(c) AS data FROM "GameCommand" c WHERE "sessionId"=$1 ORDER BY "id"', [id])).rows;
 const votes = (await sql('SELECT row_to_json(v) AS data FROM "SocialVote" v JOIN "SocialRound" r ON r."id"=v."roundId" WHERE r."sessionId"=$1 ORDER BY v."id"', [id])).rows;
 const rounds = (await sql('SELECT row_to_json(r) AS data FROM "SocialRound" r WHERE "sessionId"=$1 ORDER BY "number"', [id])).rows;
 const scores = (await sql('SELECT row_to_json(e) AS data FROM "ScoreEvent" e WHERE "sessionId"=$1 ORDER BY "id"', [id])).rows;
 return { session, commands, votes, rounds, scores };
}
test('D2 M09: delayed old vote is rejected after rematch; client refreshes and votes without reload', async ({ page, browser }, info) => {
 test.setTimeout(120000); const { id, phones } = await socialRoom(page, browser), phone = phones[0].page, old = await read<SocialView>(phone, 'social', id, true); let resume!: () => void, captured!: () => void;
 const gate = new Promise<void>(resolve => { resume = resolve; }), started = new Promise<void>(resolve => { captured = resolve; }); const wires: { key: string; action: { roundId: string; ballot: number } }[] = [], statuses: number[] = []; let refreshes = 0;
 phone.on('request', request => { if (new URL(request.url()).pathname === `/api/social/${id}/player`) refreshes++; });
 await phone.route(`**/api/social/${id}/commands`, async route => { wires.push(route.request().postDataJSON()); if (wires.length === 1) { captured(); await gate; } const response = await route.fetch(); statuses.push(response.status()); await route.fulfill({ response }); });
 try {
  await phone.getByLabel(phones[1].name, { exact: true }).check(); await phone.getByRole('button', { name: 'أرسل صوتك', exact: true }).click(); await started;
  expect(wires[0].action.roundId).toBe(old.roundId); await command(page, 'social', id, 'CLOSE_VOTING'); await command(page, 'social', id, 'COMPLETE'); await command(page, 'social', id, 'REMATCH'); await socialVoting(page, id);
  const current = await read<SocialView>(page, 'social', id); expect(current.roundId).not.toBe(old.roundId); expect(current.phase).toBe(old.phase); expect(current.ballot).toBe(old.ballot);
  const before = await socialInvariant(id); resume(); await expect(phone.locator('.form-error[role="alert"]')).toContainText('جولة سابقة'); await expect.poll(() => refreshes).toBeGreaterThan(0); expect(statuses[0]).toBe(409); expect(await socialInvariant(id)).toEqual(before);
  await expect(phone.getByText('خارج الجو · الجولة 2', { exact: true })).toBeVisible(); await expect(phone.getByRole('button', { name: 'أرسل صوتك', exact: true })).toBeDisabled();
  await phone.getByLabel(phones[1].name, { exact: true }).check(); await phone.getByRole('button', { name: 'أرسل صوتك', exact: true }).click(); await expect(phone.getByText('تم تسجيل صوتك. يمكنك تغييره قبل إغلاق التصويت.')).toBeVisible();
  expect(wires).toHaveLength(2); expect(wires[1].action.roundId).toBe(current.roundId); expect(wires[1].key).not.toBe(wires[0].key); expect(statuses).toEqual([409, 200]); expect((await read<SocialView>(page, 'social', id)).voteCount).toBe(1);
  const after = await read<SocialView>(page, 'social', id); expect(after.version).toBe(current.version + 1); expect(after.tally).toBeNull(); expect(after.reveal).toBeNull(); expect((await sql('SELECT count(*)::int n FROM "GameCommand" WHERE "sessionId"=$1 AND "key"=$2', [id, wires[0].key])).rows[0].n).toBe(0);
  const digest = createHash('sha256').update(JSON.stringify(before)).digest('hex'); await info.attach('M09-rematch-boundary', { body: JSON.stringify({ oldRoundNumber: old.round, newRoundNumber: current.round, samePhaseAndBallot: true, staleStatus: 409, exactBeforeAfterHash: digest, noStaleReceipt: true, freshVoteSucceeded: true, selectionCleared: true, noReload: true }), contentType: 'application/json' });
 } finally { resume(); for (const p of phones) await p.context.close(); }
});
test('D2 M09: simultaneous same-round votes safely rebase original keys and complete once', async ({ page, browser }, info) => {
 test.setTimeout(120000); const { id, phones } = await socialRoom(page, browser), view = await read<SocialView>(page, 'social', id), outsider = (await sql('SELECT "outsiderId" FROM "SocialRound" WHERE "id"=$1', [view.roundId])).rows[0].outsiderId;
 const target = phones.find(p => p.id !== outsider)!; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); const wires: { person: number; key: string; expectedVersion: number; action: { roundId: string; ballot: number } }[] = [], statuses: number[] = [];
 try {
  for (const [i, p] of phones.entries()) { await p.page.route(`**/api/social/${id}/commands`, async route => { const wire = route.request().postDataJSON(); wires.push({ person: i, ...wire }); if (wires.length <= 3) { if (wires.length === 3) release(); await gate; } const response = await route.fetch(); statuses.push(response.status()); await route.fulfill({ response }); }); await p.page.getByLabel(p.id === target.id ? phones.find(o => o.id !== target.id)!.name : target.name, { exact: true }).check(); }
  await Promise.all(phones.map(p => p.page.getByRole('button', { name: 'أرسل صوتك', exact: true }).click()));
  await expect.poll(async () => (await read<SocialView>(page, 'social', id)).phase).toBe('RESULTS'); expect(wires.slice(0, 3).every(w => w.expectedVersion === view.version)).toBe(true); expect(statuses).toContain(409);
  for (let i = 0; i < 3; i++) { const own = wires.filter(w => w.person === i); expect(new Set(own.map(w => w.key)).size).toBe(1); expect(own.every(w => w.action.roundId === view.roundId && w.action.ballot === view.ballot)).toBe(true); }
  const final = await read<SocialView>(page, 'social', id); expect(final.version).toBe(view.version + 3); expect(final.voteCount).toBe(3); expect((await sql('SELECT count(*)::int n FROM "SocialVote" WHERE "roundId"=$1', [view.roundId])).rows[0].n).toBe(3); expect((await sql('SELECT count(*)::int n FROM "GameCommand" WHERE "sessionId"=$1 AND "type"=\'SUBMIT_VOTE\'', [id])).rows[0].n).toBe(3); expect((await sql('SELECT count(*)::int n FROM "ScoreEvent" WHERE "sessionId"=$1', [id])).rows[0].n).toBe(0);
  for (const p of phones) { await expect(p.page.getByRole('heading', { name: 'فاز خارج الجو!' })).toBeVisible(); await expect(p.page.getByText('جارٍ إعادة الاتصال…', { exact: true })).not.toBeVisible(); }
  await info.attach('M09-concurrent-rebase', { body: JSON.stringify({ sharedOriginalVersion: true, conflictedThenRebased: true, uniqueKeys: 3, votes: 3, versionDelta: 3, oneRoundResult: true, noReload: true }), contentType: 'application/json' });
 } finally { release(); for (const p of phones) await p.context.close(); }
});
