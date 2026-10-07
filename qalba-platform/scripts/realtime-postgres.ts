import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { tokenHash, newToken } from '../src/lib/auth/crypto';
import * as lightning from '../src/lib/games/lightning/service';
import * as ordering from '../src/lib/games/ordering/service';
import * as court from '../src/lib/games/court/service';

if (!process.env.DATABASE_URL?.includes('127.0.0.1')) throw Error('Isolated local PostgreSQL required');
const mode = process.env.REALTIME_MEASURE_MODE ?? 'after';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const client = new PrismaClient({ adapter: new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0]), log: [{ level: 'query', emit: 'event' }] });
(globalThis as unknown as { prisma: PrismaClient }).prisma = client;
let sql = 0, locks = 0, transactions = 0;
client.$on('query', e => { sql++; if (/FOR UPDATE/i.test(e.query) && /GameSession/.test(e.query)) locks++; if (/^BEGIN/i.test(e.query)) transactions++; });
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const cases: { name: string; passed: boolean; detail?: unknown }[] = [];
const check = async (name: string, fn: () => Promise<unknown>) => { const detail = await fn(); cases.push({ name, passed: true, detail }); console.log('PASS', name); };
async function main() {
const host = await client.user.findUniqueOrThrow({ where: { email: 'admin@example.test' } });
await client.creditWallet.upsert({ where: { userId: host.id }, create: { userId: host.id, balance: 100 }, update: { balance: 100 } });
type Fixture = { name: string; id: string; count: number; cadence: number; read: (n: number) => Promise<{ version: number; phase: string; deadlineAt?: string | null }>; command: (type: 'PAUSE' | 'RESUME') => Promise<unknown> };
const fixtures: Fixture[] = [];
const l = await lightning.createLightningSession(host.id, ['فريق مرجان', 'فريق بحر']);
const lc = async (type: lightning.LightningView['phase'] | string) => { const v = await lightning.getLightningView(l.id, { kind: 'HOST', id: host.id }); return lightning.applyLightningCommand(l.id, host.id, randomUUID(), v.version, { type } as Parameters<typeof lightning.applyLightningCommand>[4]); };
await lc('START'); await lc('PREPARE_QUESTION'); await lc('OPEN_BUZZ');
const ld = await lightning.createLightningDisplayAccess(host.id, l.id), lv = await lightning.getLightningView(l.id, { kind: 'HOST', id: host.id });
const lb = await Promise.all(lv.teams.map(t => lightning.createLightningBuzzerAccess(host.id, l.id, t.id)));
const la: lightning.Actor[] = [{ kind: 'HOST', id: host.id }, { kind: 'DISPLAY', token: ld.token }, ...lb.map(b => ({ kind: 'BUZZER' as const, token: b.token }))];
fixtures.push({ name: 'Lightning', id: l.id, count: 4, cadence: 250, read: n => lightning.getLightningView(l.id, la[n]), command: t => lc(t) });
const o = await ordering.createOrderingSession(host.id, ['فريق مرجان', 'فريق بحر']);
const oc = async (type: string) => { const v = await ordering.getOrderingView(o.id, { kind: 'HOST', id: host.id }); return ordering.applyOrderingCommand(o.id, host.id, randomUUID(), v.version, { type } as Parameters<typeof ordering.applyOrderingCommand>[4]); };
await oc('START'); await oc('START_ROUND');
const od = await ordering.createOrderingDisplayAccess(host.id, o.id), ov = await ordering.getOrderingView(o.id, { kind: 'HOST', id: host.id });
const ob = await Promise.all(ov.teams.map(t => ordering.createOrderingControllerAccess(host.id, o.id, t.id)));
const oa: ordering.Actor[] = [{ kind: 'HOST', id: host.id }, { kind: 'DISPLAY', token: od.token }, ...ob.map(b => ({ kind: 'CONTROLLER' as const, token: b.token }))];
fixtures.push({ name: 'Ordering', id: o.id, count: 4, cadence: 250, read: n => ordering.getOrderingView(o.id, oa[n]), command: t => oc(t) });
const c = await court.createCourtSession(host.id, ['فريق مرجان', 'فريق بحر']);
const jurors = Array.from({ length: 3 }, () => newToken());
for (const [position, token] of jurors.entries()) await client.courtParticipant.create({ data: { sessionId: c.id, name: `محلف ${position}`, position, tokenHash: tokenHash(token) } });
const cc = async (type: string) => { const v = await court.getCourtView(c.id, { kind: 'HOST', id: host.id }); return court.applyCourtCommand(c.id, host.id, randomUUID(), v.version, { type } as Parameters<typeof court.applyCourtCommand>[4]); };
await cc('START'); await cc('START_ROUND'); await cc('START_PREPARATION');
const cd = await court.createCourtDisplayAccess(host.id, c.id);
const ca: court.Actor[] = [{ kind: 'HOST', id: host.id }, { kind: 'DISPLAY', token: cd.token }, ...jurors.map(token => ({ kind: 'JUROR' as const, token }))];
fixtures.push({ name: 'Court', id: c.id, count: 5, cadence: 1000, read: n => court.getCourtView(c.id, ca[n]), command: t => cc(t) });
const measurements: unknown[] = [];
try {
 for (const f of fixtures) {
  for (const active of [false, true]) {
   // Keep timed test fixtures comfortably away from their real authoritative deadline.
   await client.$executeRawUnsafe('UPDATE "GameSession" SET "state"=jsonb_set("state",\'{deadlineAt}\',to_jsonb($2::bigint)) WHERE "id"=$1', f.id, Date.now() + 120_000);
   const starts = await Promise.all(Array.from({ length: f.count }, (_, n) => f.read(n)));
   const before = { sql, locks, transactions }; let projections = 0, checks = 0; const latencies: number[] = [];
   const started = performance.now(), duration = 6000;
   const viewers = Array.from({ length: f.count }, (_, n) => (async () => {
    const poll = mode === 'after' ? (await import('../src/lib/realtime/view-poll')).createViewPoll({ id: f.id, initial: starts[n], host: n === 0, read: () => { projections++; return f.read(n); } }) : undefined;
    while (performance.now() - started < duration) {
     if (poll) { checks++; await poll(); } else { projections++; await f.read(n); }
     await sleep(f.cadence);
    }
   })());
   const commands = active ? (async () => { for (const type of ['PAUSE', 'RESUME', 'PAUSE', 'RESUME'] as const) { await sleep(1100); const sent = performance.now(); await f.command(type); latencies.push(performance.now() - sent); } })() : Promise.resolve();
   await Promise.all([...viewers, commands]);
   const connections = (await pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend'")).rows[0].n;
   const measurement = { game: f.name, viewers: f.count, mode, scenario: active ? 'commands-during-reads' : 'idle', elapsedMs: Math.round(performance.now() - started), projectionCalls: projections, versionChecks: checks, observedSqlStatements: sql - before.sql, observedGameSessionForUpdate: locks - before.locks, observedBeginStatements: transactions - before.transactions, commandLatencyMs: latencies.map(x => Math.round(x * 100) / 100), nativeClientConnections: connections, poolMax: 8 };
   measurements.push(measurement); console.log(JSON.stringify(measurement));
   if (mode === 'after' && !active) assert.equal(measurement.observedGameSessionForUpdate, 0);
  }
 }
 if (mode === 'after') {
  for (const f of fixtures) {
   await check(`${f.name}: pure read passes a held command row lock; command waits`, async () => {
    const blocker = await pool.connect(); await blocker.query('BEGIN'); await blocker.query('SELECT "id" FROM "GameSession" WHERE "id"=$1 FOR UPDATE', [f.id]);
    try { const start = performance.now(); const view = await Promise.race([f.read(0), sleep(1500).then(() => { throw Error('Pure projection blocked'); })]); const readMs = Math.round(performance.now() - start); let finished = false; const command = f.command('PAUSE').then(() => { finished = true; }); await sleep(100); assert.equal(finished, false); await blocker.query('COMMIT'); await command; await f.command('RESUME'); return { readMs, readVersion: view.version, commandBlockedUntilRelease: true }; } finally { await blocker.query('ROLLBACK'); blocker.release(); }
   });
   await check(`${f.name}: concurrent due views resolve authoritative timeout exactly once`, async () => {
    if (f.name === 'Lightning') { const v = await lightning.getLightningView(l.id, la[0]); await lightning.applyBuzz(l.id, lb[0].token, randomUUID(), v.version); }
    const before = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } });
    await client.$executeRawUnsafe('UPDATE "GameSession" SET "state"=jsonb_set("state",\'{deadlineAt}\',to_jsonb($2::bigint)) WHERE "id"=$1', f.id, Date.now() - 1000);
    await Promise.all(Array.from({ length: 12 }, (_, n) => f.read(n % f.count)));
    const after = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } });
    assert.equal(after.stateVersion, before.stateVersion + 1);
    assert.equal(await client.gameCommand.count({ where: { sessionId: f.id, type: 'TIMEOUT' } }), 1);
    return { stateVersionDelta: 1, timeoutReceipts: 1 };
   });
  }
 }
} finally {
 writeFileSync(process.env.REALTIME_MEASURE_REPORT ?? `realtime-${mode}.json`, JSON.stringify({ mode, database: (await pool.query('SELECT version()')).rows[0].version, sourceFingerprint: process.env.SOURCE_FINGERPRINT, measurements, cases, passed: cases.length }, null, 2));
 await client.$disconnect(); await pool.end();
}

}
main().catch(e => { console.error(e); process.exitCode = 1; });
