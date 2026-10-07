import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { RankedView } from '@/lib/games/ranked/service';
const harness = vi.hoisted(() => ({ cursor: 0, slots: [] as { value: unknown; deps?: unknown[] }[], effects: [] as (() => void | (() => void))[], apply: null as null | ((view: RankedView, sent: number) => void) }));
vi.mock('react', () => ({
 useState(initial: unknown) { const i = harness.cursor++; harness.slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [harness.slots[i].value, (next: unknown) => { harness.slots[i].value = typeof next === 'function' ? next(harness.slots[i].value) : next; }]; },
 useRef(initial: unknown) { const i = harness.cursor++; harness.slots[i] ??= { value: { current: initial } }; return harness.slots[i].value; },
 useEffect(effect: () => void | (() => void), deps: unknown[]) { const i = harness.cursor++; if (!harness.slots[i] || deps.some((v, n) => v !== harness.slots[i].deps?.[n])) { harness.slots[i] = { value: null, deps }; harness.effects.push(effect); } },
}));
vi.mock('@/lib/realtime/client', () => ({ connectLive: (options: { apply: typeof harness.apply }) => { harness.apply = options.apply; return { close: vi.fn() }; } }));
import { useRankedLive } from './ranked-live';
let initial: RankedView, fetcher: ReturnType<typeof vi.fn>, cleanup: (() => void)[];
const action = { type: 'SUBMIT_GUESS' as const, guess: 'نفس التخمين' };
function render() {
 harness.cursor = 0;
 // eslint-disable-next-line react-hooks/rules-of-hooks -- Calls the real hook with deterministic mocked React state/effect primitives.
 const hook = useRankedLive(initial, 'host');
 for (const effect of harness.effects.splice(0)) { const fn = effect(); if (fn) cleanup.push(fn); } return hook;
}
function apply(next: RankedView) { harness.apply!(next, performance.now()); }
function bodies() { return fetcher.mock.calls.filter(([, init]) => init?.method === 'POST').map(([, init]) => JSON.parse(init.body) as { key: string; expectedVersion: number }); }
function response(view: RankedView) { return { ok: true, json: async () => ({ session: view, duplicate: true }) }; }
beforeEach(() => {
 harness.cursor = 0; harness.slots = []; harness.effects = []; harness.apply = null; cleanup = []; vi.useFakeTimers();
 initial = { id: 'session', version: 7, serverNow: new Date().toISOString(), phase: 'GUESS_ACTIVE', pausedPhase: null, matchNumber: 1, roundNumber: 1, roundCount: 5, activeTeamId: 'a', attempts: [0, 0], attemptsPerTeam: 10, deadlineAt: null, remainingMs: null, lastEvent: [], lastResult: null, question: null, slots: [], roundPoints: [0, 0], results: [], winnerIds: [], teams: [] };
 fetcher = vi.fn().mockRejectedValue(new Error('response lost')); vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { for (const fn of cleanup) fn(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('lost response and unchanged authoritative intent retry with the same key/version', async () => {
 let hook = render(); expect(await hook.send(action)).toBe(false); apply({ ...initial, serverNow: new Date(Date.now() + 1000).toISOString() }); hook = render();
 fetcher.mockResolvedValue(response({ ...initial, version: 8 })); expect(await hook.send(action)).toBe(true); const sent = bodies(); expect(sent).toHaveLength(2); expect(sent[1]).toEqual(sent[0]); expect(sent[0].expectedVersion).toBe(7);
});
it.each([429, 500, 503])('ambiguous HTTP %s plus unavailable refresh preserves the same unresolved key', async status => {
 fetcher.mockResolvedValueOnce({ ok: false, status, json: async () => ({ error: 'temporary response failure' }) }).mockRejectedValueOnce(new Error('refresh unavailable')).mockResolvedValueOnce(response({ ...initial, version: 8 }));
 let hook = render(); expect(await hook.send(action)).toBe(false); hook = render(); expect(await hook.send(action)).toBe(true); const sent = bodies(); expect(sent).toHaveLength(2); expect(sent[1]).toEqual(sent[0]);
});
it('two rapid clicks before React renders start only one in-flight intent', async () => {
 let finish!: (v: unknown) => void; fetcher.mockImplementation(() => new Promise(resolve => { finish = resolve; })); const hook = render(); const first = hook.send(action), second = hook.send(action);
 expect(bodies()).toHaveLength(1); finish(response({ ...initial, version: 8 })); expect(await first).toBe(true); expect(await second).toBe(false);
});
it.each([
 ['later attempt', { attempts: [1, 0], activeTeamId: 'b' }],
 ['later round', { roundNumber: 2, attempts: [0, 0] }],
 ['rematch', { matchNumber: 2, attempts: [0, 0] }],
 ['phase progress', { phase: 'ROUND_RESULTS' as const }],
 ['resolved already-revealed action', { lastResult: { kind: 'ALREADY_REVEALED' as const, rank: 1 } }],
])('%s invalidates the old key before an identical action', async (_label, change) => {
 let hook = render(); await hook.send(action); const next = { ...initial, ...change, version: 8 }; apply(next); hook = render(); await hook.send(action); const sent = bodies(); expect(sent).toHaveLength(2); expect(sent[1].key).not.toBe(sent[0].key); expect(sent[1].expectedVersion).toBe(8);
});
it('old SSE/fallback state cannot resurrect the key or downgrade the retry version', async () => {
 let hook = render(); await hook.send(action); const next = { ...initial, version: 9, attempts: [1, 1] }; apply(next); apply(initial); hook = render(); await hook.send(action); const sent = bodies(); expect(sent[1].key).not.toBe(sent[0].key); expect(sent[1].expectedVersion).toBe(9); expect(hook.view.version).toBe(9);
});
it('progress arriving during a lost response invalidates the pending intent', async () => {
 let fail!: (cause: Error) => void; fetcher.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; })); let hook = render(); const first = hook.send(action);
 apply({ ...initial, version: 8, attempts: [1, 0] }); fail(new Error('response lost')); await first; hook = render(); await hook.send(action); const sent = bodies(); expect(sent[1].key).not.toBe(sent[0].key); expect(sent[1].expectedVersion).toBe(8);
});
