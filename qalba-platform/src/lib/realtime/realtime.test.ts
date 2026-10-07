import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), marker: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: () => ({ $transaction: mocks.transaction, gameSession: { findUnique: mocks.marker } }) }));
import { readDeadlineView, ViewDeadlineDue } from './read-view';
import { classifyRealtimeError, RealtimeAccessError } from './errors';
import { createViewPoll } from './view-poll';
import { acquireStreamSlot, realtimeResponse } from './stream';
import { HostAuthInvalidError, HostAuthTransientError } from '@/lib/auth/host-stream';
import { SocialError } from '@/lib/games/social-deduction/module';
import { LightningError } from '@/lib/games/lightning/module';
import { CourtError } from '@/lib/games/court/module';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-06T12:00:00Z')); vi.clearAllMocks(); mocks.marker.mockResolvedValue({ stateVersion: 1 }); });
afterEach(() => vi.useRealTimers());
describe('M06 projection transaction boundary', () => {
 it('pure read uses one consistent repeatable-read snapshot and no write lock', async () => {
  const tx = {} as Parameters<Parameters<typeof readDeadlineView>[1]>[0], lock = vi.fn(), read = vi.fn().mockResolvedValue({ version: 1 });
  mocks.transaction.mockImplementation(async fn => fn(tx));
  expect(await readDeadlineView('room', lock, read)).toEqual({ version: 1 });
  expect(lock).not.toHaveBeenCalled(); expect(read).toHaveBeenCalledWith(tx, false);
  expect(mocks.transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'RepeatableRead', timeout: 20_000 });
 });
 it('due observation exits snapshot, then locks and re-reads in a fresh transaction', async () => {
  const tx = {} as Parameters<Parameters<typeof readDeadlineView>[1]>[0], order: string[] = [];
  mocks.transaction.mockImplementation(async fn => fn(tx));
  const result = await readDeadlineView('room', async () => { order.push('lock'); }, async (_tx, due) => { order.push(due ? 'authoritative re-read' : 'snapshot'); if (!due) throw new ViewDeadlineDue(); return 'resolved once'; });
  expect(result).toBe('resolved once'); expect(order).toEqual(['snapshot', 'lock', 'authoritative re-read']); expect(mocks.transaction).toHaveBeenCalledTimes(2);
  expect(mocks.transaction.mock.calls[1][1].isolationLevel).toBeUndefined();
 });
 it('DB errors never enter a competing timeout mutation path', async () => {
  mocks.transaction.mockRejectedValue(new Error('pool unavailable')); const lock = vi.fn();
  await expect(readDeadlineView('room', lock, vi.fn())).rejects.toThrow('pool unavailable'); expect(lock).not.toHaveBeenCalled(); expect(mocks.transaction).toHaveBeenCalledTimes(1);
 });
});
describe('M06 per-audience version probing', () => {
 it('250ms idle host probes use six full reads per minute, never four full reads/sec', async () => {
  const read = vi.fn().mockResolvedValue({ version: 1, phase: 'READY', deadlineAt: null }); const poll = createViewPoll({ id: 'room', initial: { version: 1, phase: 'READY', deadlineAt: null }, host: true, read });
  for (let ms = 250; ms <= 60_000; ms += 250) { vi.setSystemTime(new Date('2026-10-06T12:00:00Z').getTime() + ms); expect(await poll()).toBeNull(); }
  expect(read).toHaveBeenCalledTimes(6); expect(mocks.marker).toHaveBeenCalledTimes(240); expect(mocks.marker.mock.calls.every(([v]) => JSON.stringify(v.select) === '{"stateVersion":true}')).toBe(true);
 });
 it('fast non-host streams still revalidate through their own projection every second', async () => {
  const read = vi.fn().mockResolvedValue({ version: 1 }); const poll = createViewPoll({ id: 'room', initial: { version: 1 }, host: false, read });
  for (let ms = 250; ms <= 3000; ms += 250) { vi.advanceTimersByTime(250); await poll(); }
  expect(read).toHaveBeenCalledTimes(3);
 });
 it('changed version always reads and reauthorizes before emitting, without audience reuse', async () => {
  const hostRead = vi.fn().mockResolvedValue({ version: 2, secret: 'host-only' }), tvRead = vi.fn().mockResolvedValue({ version: 2, secret: null });
  const host = createViewPoll({ id: 'room', initial: { version: 1 }, host: true, read: hostRead }), tv = createViewPoll({ id: 'room', initial: { version: 1 }, host: false, read: tvRead });
  mocks.marker.mockResolvedValue({ stateVersion: 2 }); expect(await host()).toEqual({ version: 2, secret: 'host-only' }); expect(await tv()).toEqual({ version: 2, secret: null });
  expect(hostRead).toHaveBeenCalledTimes(1); expect(tvRead).toHaveBeenCalledTimes(1);
 });
 it('due deadline triggers server resolution even without a version change', async () => {
  const read = vi.fn().mockResolvedValue({ version: 2, phase: 'RESULTS', deadlineAt: null });
  const poll = createViewPoll({ id: 'room', initial: { version: 1, phase: 'VOTING', deadlineAt: new Date(Date.now() + 500).toISOString() }, host: true, read });
  vi.advanceTimersByTime(500); expect((await poll())?.version).toBe(2); mocks.marker.mockResolvedValue({ stateVersion: 2 }); expect(await poll()).toBeNull(); expect(read).toHaveBeenCalledTimes(1);
 });
 it('paused deadline is not resolved by transport', async () => {
  const read = vi.fn(); const poll = createViewPoll({ id: 'room', initial: { version: 1, phase: 'PAUSED', deadlineAt: new Date(Date.now() - 100).toISOString() }, host: true, read });
  await poll(); expect(read).not.toHaveBeenCalled();
 });
 it('a manual host timer does not force repeated projections after its deadline', async () => {
  const read = vi.fn(); const poll = createViewPoll({ id: 'room', initial: { version: 1, phase: 'DISCUSSION', deadlineAt: new Date(Date.now() - 100).toISOString() }, host: true, read, resolvesDeadline: () => false });
  for (let i = 0; i < 9; i++) { vi.advanceTimersByTime(1000); await poll(); } expect(read).not.toHaveBeenCalled();
 });
 it('authoritative missing row is terminal, lookup failure remains transient', async () => {
  const poll = createViewPoll({ id: 'room', initial: { version: 1 }, host: true, read: vi.fn() });
  mocks.marker.mockResolvedValue(null); await expect(poll()).rejects.toBeInstanceOf(RealtimeAccessError);
  mocks.marker.mockRejectedValue(new Error('temporary DB')); await expect(poll()).rejects.toThrow('temporary DB');
 });
});
describe('M07 confirmed access loss only', () => {
 it.each([new HostAuthInvalidError(), new SocialError('expired', 403), new LightningError('missing', 404), new CourtError('forbidden', 403), new RealtimeAccessError(410)])('classifies confirmed access error as terminal: %s', e => expect(classifyRealtimeError(e)).toBe('TERMINAL'));
 it.each([new HostAuthTransientError(), new Error('pool exhausted'), { code: 'P2034' }, { status: 403 }, new LightningError('schema failure', 500), new CourtError('stale', 409)])('does not turn infrastructure/internal errors into access loss: %s', e => expect(classifyRealtimeError(e)).toBe('TRANSIENT'));
});
describe('M06/M07 bounded transport lifecycle', () => {
 const response = (signal: AbortSignal, next = vi.fn().mockResolvedValue(null), extra = {}) => realtimeResponse(new Request('http://example.test/events', { signal }), { sessionId: 'r-' + Math.random(), audience: 'HOST', credential: 'original-session', initial: { version: 1, private: 'allowed-initial' }, cadence: 250, next, ...extra });
 const initial = async (r: Response) => { const reader = r.body!.getReader(); await reader.read(); return reader; };
 it('caps only the same exact credential/audience/room and releases idempotently', () => {
  const a = acquireStreamSlot('cap-room', 'HOST', 'session-a')!, b = acquireStreamSlot('cap-room', 'HOST', 'session-a')!;
  expect(acquireStreamSlot('cap-room', 'HOST', 'session-a')).toBeNull();
  const others = [acquireStreamSlot('cap-room', 'DISPLAY', 'display-hash')!, acquireStreamSlot('cap-room', 'PLAYER', 'participant-hash')!, acquireStreamSlot('cap-room', 'HOST', 'session-b')!, acquireStreamSlot('other-room', 'HOST', 'session-a')!];
  expect(others.every(Boolean)).toBe(true); a(); a(); const replacement = acquireStreamSlot('cap-room', 'HOST', 'session-a')!; expect(replacement).toBeTypeOf('function'); replacement(); b(); others.forEach(f => f());
 });
 it('aborted stream closes, stops polling and releases its slot', async () => {
  const abort = new AbortController(), next = vi.fn().mockResolvedValue(null), r = response(abort.signal, next), reader = await initial(r);
  await vi.advanceTimersByTimeAsync(500); expect(next).toHaveBeenCalledTimes(2); abort.abort(); expect((await reader.read()).done).toBe(true);
  await vi.advanceTimersByTimeAsync(60_000); expect(next).toHaveBeenCalledTimes(2);
 });
 it('consumer cancellation stops a pending wait without a zombie loop', async () => {
  const next = vi.fn(), reader = await initial(response(new AbortController().signal, next)); await reader.cancel(); await vi.advanceTimersByTimeAsync(60_000); expect(next).not.toHaveBeenCalled();
 });
 it('slow consumer has a bounded three-chunk queue and stops DB work', async () => {
  const next = vi.fn().mockResolvedValue({ version: 2, private: 'own-view' }), r = response(new AbortController().signal, next);
  await vi.advanceTimersByTimeAsync(10_000); const calls = next.mock.calls.length; expect(calls).toBeLessThanOrEqual(2);
  await vi.advanceTimersByTimeAsync(60_000); expect(next).toHaveBeenCalledTimes(calls); await r.body!.cancel();
 });
 it('transient DB failure emits retryable connection error, never access-ended', async () => {
  const next = vi.fn().mockRejectedValue(new Error('temporary database failure')), reader = await initial(response(new AbortController().signal, next));
  const pending = reader.read(); await vi.advanceTimersByTimeAsync(250); const chunk = new TextDecoder().decode((await pending).value);
  expect(chunk).toContain('event: connection-error'); expect(chunk).toContain('retry: 5000'); expect(chunk).not.toContain('access-ended'); expect((await reader.read()).done).toBe(true);
 });
 it('H01 invalidation before emit prevents even one later private payload', async () => {
  const guard = vi.fn().mockResolvedValue(undefined), next = vi.fn().mockResolvedValue({ version: 2, private: 'later-private' });
  const reader = await initial(response(new AbortController().signal, next, { assertActive: guard })); guard.mockRejectedValue(new HostAuthInvalidError());
  const pending = reader.read(); await vi.advanceTimersByTimeAsync(250); const text = new TextDecoder().decode((await pending).value);
  expect(text).toContain('access-ended'); expect(text).not.toContain('later-private'); expect(next).not.toHaveBeenCalled(); expect((await reader.read()).done).toBe(true);
 });
 it('revocation detected after read still suppresses the computed private result', async () => {
  const guard = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValue(new HostAuthInvalidError());
  const reader = await initial(response(new AbortController().signal, vi.fn().mockResolvedValue({ version: 2, private: 'suppressed' }), { assertActive: guard }));
  const pending = reader.read(); await vi.advanceTimersByTimeAsync(250); const text = new TextDecoder().decode((await pending).value); expect(text).toContain('access-ended'); expect(text).not.toContain('suppressed');
 });
 it('H01 transient lookup closes retryably rather than revoking', async () => {
  const guard = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValue(new HostAuthTransientError()); const reader = await initial(response(new AbortController().signal, vi.fn(), { assertActive: guard }));
  const pending = reader.read(); await vi.advanceTimersByTimeAsync(250); expect(new TextDecoder().decode((await pending).value)).toContain('connection-error');
 });
});
describe('structural coverage without changing game commands/projections', () => {
 it.each(['social', 'letter-network', 'survey-show', 'secret-word', 'bluff', 'ranked', 'lightning', 'ordering', 'court'])('%s binds original Host session and checks protected transport before/after reads', game => {
  const code = readFileSync(resolve(`src/app/api/${game}/[id]/events/route.ts`), 'utf8'); expect(code).toContain('currentAuthSession'); expect(code).toContain('auth.sessionId'); expect(code).toContain('realtimeResponse'); expect(code).toContain('assertActive:'); expect(code).toContain('createViewPoll'); expect(code).not.toContain('event: access-ended');
 });
 it.each(['social', 'letter', 'survey', 'forbidden', 'bluff', 'ranked', 'lightning', 'ordering', 'court'])('%s hook uses one bounded transport and terminal callback', game => {
  const code = readFileSync(resolve(`src/components/${game}-live.ts`), 'utf8'); expect(code).toContain('connectLive'); expect(code).toContain('terminal:'); expect(code).not.toContain('setInterval(refresh');
 });
});
