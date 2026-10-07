import { terminalAccessStatus } from './access-status';

export const LIVE_RETRY_BASE_MS = 3000;
export const LIVE_RETRY_CAP_MS = 30_000;
export function liveRetryDelay(attempt: number) { return Math.min(LIVE_RETRY_CAP_MS, LIVE_RETRY_BASE_MS * 2 ** Math.min(4, Math.max(0, attempt))); }

/** One transport and one serialized fallback loop per mounted audience. No command behavior lives here. */
export function connectLive<T>(options: {
  events: string; endpoint: string; apply: (view: T, sent: number) => void;
  temporary: () => void; terminal: () => void; now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let ended = false, healthy = false, es: EventSource | undefined, reconnect: ReturnType<typeof setTimeout> | undefined, poll: ReturnType<typeof setTimeout> | undefined;
  let transportAttempt = 0, pollAttempt = 0, generation = 0, reading = false, abort: AbortController | undefined;
  const stopFallback = () => { clearTimeout(poll); poll = undefined; generation++; abort?.abort(); };
  const close = () => { if (ended) return; ended = true; healthy = false; clearTimeout(reconnect); reconnect = undefined; stopFallback(); es?.close(); es = undefined; };
  const terminal = () => { if (ended) return; close(); options.terminal(); };
  const schedulePoll = () => { if (!ended && !healthy && !poll && !reading) poll = setTimeout(() => { poll = undefined; void refresh(); }, liveRetryDelay(pollAttempt)); };
  const refresh = async () => {
    if (ended || healthy || reading) return;
    reading = true; const ownGeneration = generation, sent = now(); abort = new AbortController();
    try {
      const response = await fetch(options.endpoint, { cache: 'no-store', signal: abort.signal });
      if (ended || healthy || ownGeneration !== generation) return;
      if (!response.ok) { if (terminalAccessStatus(response.status)) { terminal(); return; } throw Error('Temporary live read failure'); }
      const view = await response.json() as T;
      if (ended || healthy || ownGeneration !== generation) return;
      pollAttempt = 0; transportAttempt = 0; options.apply(view, sent);
    } catch {
      if (!ended && !healthy && ownGeneration === generation) { pollAttempt++; options.temporary(); }
    } finally { reading = false; abort = undefined; schedulePoll(); }
  };
  const failed = () => {
    if (ended || reconnect) return;
    healthy = false; es?.close(); es = undefined; options.temporary(); schedulePoll();
    reconnect = setTimeout(() => { reconnect = undefined; open(); }, liveRetryDelay(transportAttempt++));
  };
  const open = () => {
    if (ended) return;
    const source = new EventSource(options.events); es = source;
    source.onopen = () => { if (ended || source !== es) return; healthy = true; stopFallback(); };
    source.addEventListener('state', event => {
      if (ended || source !== es) return;
      try { const view = JSON.parse((event as MessageEvent).data) as T; healthy = true; transportAttempt = 0; pollAttempt = 0; stopFallback(); options.apply(view, now()); } catch { failed(); }
    });
    source.addEventListener('access-ended', () => { if (source === es) terminal(); });
    source.addEventListener('connection-error', () => { if (source === es) failed(); });
    source.onerror = () => { if (source === es) failed(); };
  };
  open();
  return { close };
}
