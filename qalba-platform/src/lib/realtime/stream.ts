import { createHash } from 'node:crypto';
import { classifyRealtimeError } from './errors';

export const STREAMS_PER_CREDENTIAL = 2;
export const SSE_HEARTBEAT_MS = 10_000;
const registry = globalThis as unknown as { quddamStreamSlots?: Map<string, number> };
function slots() { return registry.quddamStreamSlots ??= new Map(); }
export function acquireStreamSlot(sessionId: string, audience: string, credential: string): (() => void) | null {
  const key = createHash('sha256').update(JSON.stringify([sessionId, audience, credential])).digest('hex');
  const count = slots().get(key) ?? 0;
  if (count >= STREAMS_PER_CREDENTIAL) return null;
  slots().set(key, count + 1); let released = false;
  return () => { if (released) return; released = true; const remaining = (slots().get(key) ?? 1) - 1; if (remaining > 0) slots().set(key, remaining); else slots().delete(key); };
}

/** Bounded transport loop only; authorization, projections and deadline rules stay in their services. */
export function realtimeResponse<T>(request: Request, options: {
  sessionId: string; audience: string; credential: string; initial: T; cadence: number;
  next: () => Promise<T | null>; assertActive?: () => Promise<void>;
  complete?: (view: T) => boolean; lifetimeMs?: number;
}) {
  const release = acquireStreamSlot(options.sessionId, options.audience, options.credential);
  if (!release) return Response.json({ error: 'وصلت إلى حد اتصالات هذا الرابط. أغلق نافذة أخرى وحاول مجددًا.' }, { status: 429, headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' } });
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, wake: (() => void) | undefined;
  let streamController: ReadableStreamDefaultController<Uint8Array>;
  const cleanup = () => { if (stopped) return; stopped = true; clearTimeout(timer); wake?.(); wake = undefined; request.signal.removeEventListener('abort', cleanup); release(); try { streamController?.close(); } catch { /* consumer already cancelled */ } };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      request.signal.addEventListener('abort', cleanup, { once: true });
      if (request.signal.aborted) cleanup();
      void (async () => {
        const encoder = new TextEncoder(), started = Date.now(); let heartbeat = started;
        const send = (text: string) => { if (!stopped && !request.signal.aborted) controller.enqueue(encoder.encode(text)); };
        const state = (view: T) => send(`event: state\ndata: ${JSON.stringify(view)}\n\n`);
        try {
          await options.assertActive?.(); if (stopped) return;
          state(options.initial);
          if (options.complete?.(options.initial)) { send('event: complete\ndata: {}\n\n'); return; }
          while (!stopped) {
            await new Promise<void>(resolve => { wake = () => { clearTimeout(timer); wake = undefined; resolve(); }; timer = setTimeout(wake, options.cadence); });
            if (stopped) break;
            // Never build an unbounded queue or do DB work for a stalled consumer.
            if ((controller.desiredSize ?? 0) <= 0 || options.lifetimeMs && Date.now() - started >= options.lifetimeMs) break;
            await options.assertActive?.(); if (stopped) break;
            const view = await options.next(); await options.assertActive?.(); if (stopped) break;
            if (view) state(view);
            if (view && options.complete?.(view)) { send('event: complete\ndata: {}\n\n'); break; }
            if (Date.now() - heartbeat >= SSE_HEARTBEAT_MS) { send(': heartbeat\n\n'); heartbeat = Date.now(); }
          }
        } catch (error) {
          if (!stopped && (controller.desiredSize ?? 0) > 0) send(classifyRealtimeError(error) === 'TERMINAL' ? 'event: access-ended\ndata: {}\n\n' : 'retry: 5000\nevent: connection-error\ndata: {"retryable":true}\n\n');
        } finally {
          cleanup();
        }
      })();
    }, cancel: cleanup,
  }, { highWaterMark: 3 });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'Referrer-Policy': 'no-referrer', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' } });
}
