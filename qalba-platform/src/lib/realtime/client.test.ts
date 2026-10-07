import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { connectLive, liveRetryDelay } from './client';
class Source extends EventTarget {
 static all: Source[] = [];
 onopen: (() => void) | null = null; onerror: (() => void) | null = null; closed = false;
 constructor(public url: string) { super(); Source.all.push(this); }
 close() { this.closed = true; }
 state(view = { version: 1 }) { this.dispatchEvent(new MessageEvent('state', { data: JSON.stringify(view) })); }
 event(name: string) { this.dispatchEvent(new MessageEvent(name, { data: '{}' })); }
}
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.useFakeTimers(); Source.all = []; vi.stubGlobal('EventSource', Source); fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function open() { const apply = vi.fn(), terminal = vi.fn(), temporary = vi.fn(); const live = connectLive({ endpoint: '/view', events: '/events', apply, terminal, temporary }); return { live, apply, terminal, temporary }; }
it('backoff is bounded at 3/6/12/24/30 seconds', () => { expect(Array.from({ length: 8 }, (_, i) => liveRetryDelay(i))).toEqual([3000, 6000, 12000, 24000, 30000, 30000, 30000, 30000]); });
it('healthy SSE performs no duplicate fallback polling', async () => { const x = open(); Source.all[0].onopen!(); Source.all[0].state(); await vi.advanceTimersByTimeAsync(120_000); expect(fetcher).not.toHaveBeenCalled(); expect(x.apply).toHaveBeenCalledTimes(1); x.live.close(); });
it('transient failure reconnects and successful state stops fallback without reload', async () => {
 const x = open(); fetcher.mockResolvedValue({ ok: true, json: async () => ({ version: 2 }) }); Source.all[0].onerror!();
 await vi.advanceTimersByTimeAsync(3000); expect(fetcher).toHaveBeenCalledTimes(1); expect(Source.all).toHaveLength(2); Source.all[1].onopen!(); Source.all[1].state({ version: 3 });
 const count = fetcher.mock.calls.length; await vi.advanceTimersByTimeAsync(120_000); expect(fetcher).toHaveBeenCalledTimes(count); expect(x.terminal).not.toHaveBeenCalled(); expect(x.apply).toHaveBeenLastCalledWith({ version: 3 }, expect.any(Number)); x.live.close();
});
it('repeated transient failures back off and cannot form a busy loop', async () => {
 const x = open(); fetcher.mockRejectedValue(new Error('DB down')); Source.all[0].onerror!();
 for (const delay of [3000, 6000, 12000, 24000, 30000]) { await vi.advanceTimersByTimeAsync(delay); Source.all.at(-1)!.onerror!(); }
 expect(fetcher).toHaveBeenCalledTimes(5); expect(Source.all).toHaveLength(6); expect(x.terminal).not.toHaveBeenCalled(); x.live.close();
});
it.each([401, 403, 404, 410])('confirmed HTTP %s terminates and clears private state immediately', async status => {
 const x = open(); fetcher.mockResolvedValue({ ok: false, status }); Source.all[0].onerror!(); await vi.advanceTimersByTimeAsync(3000);
 expect(x.terminal).toHaveBeenCalledTimes(1); const calls = fetcher.mock.calls.length; await vi.advanceTimersByTimeAsync(120_000); expect(fetcher).toHaveBeenCalledTimes(calls); expect(Source.all.every(s => s.closed)).toBe(true);
});
it.each([429, 500, 503])('HTTP %s remains retryable rather than access-ended', async status => {
 const x = open(); fetcher.mockResolvedValue({ ok: false, status }); Source.all[0].onerror!(); await vi.advanceTimersByTimeAsync(3000); expect(x.terminal).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(6000); expect(fetcher).toHaveBeenCalledTimes(2); x.live.close();
});
it('genuine SSE access-ended clears immediately, cancels retry and ignores later events', async () => {
 const x = open(); const s = Source.all[0]; s.event('access-ended'); expect(x.terminal).toHaveBeenCalledTimes(1); s.state({ version: 99 }); s.onerror!(); await vi.advanceTimersByTimeAsync(120_000); expect(x.apply).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled(); expect(Source.all).toHaveLength(1);
});
it('retryable SSE event does not clear valid authorization', async () => { const x = open(); Source.all[0].event('connection-error'); expect(x.temporary).toHaveBeenCalled(); expect(x.terminal).not.toHaveBeenCalled(); x.live.close(); });
it('in-flight fallback cannot overwrite SSE recovery or terminal secret clearing', async () => {
 let finish!: (r: unknown) => void; fetcher.mockImplementation(() => new Promise(r => { finish = r; })); const x = open(); Source.all[0].onerror!(); await vi.advanceTimersByTimeAsync(3000); const s = Source.all[1]; s.onopen!(); s.state({ version: 3 });
 finish({ ok: true, json: async () => ({ version: 99 }) }); await vi.advanceTimersByTimeAsync(0); expect(x.apply).toHaveBeenCalledTimes(1); expect(x.apply.mock.calls[0][0]).toEqual({ version: 3 });
 s.event('access-ended'); await vi.advanceTimersByTimeAsync(120_000); expect(x.terminal).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('unmount cancels retry, polling, and all later UI updates', async () => { const x = open(); Source.all[0].onerror!(); x.live.close(); await vi.advanceTimersByTimeAsync(120_000); expect(fetcher).not.toHaveBeenCalled(); expect(Source.all).toHaveLength(1); });
