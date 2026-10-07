import { db } from '@/lib/db';
import { RealtimeAccessError } from './errors';

type MarkerView = { version: number; phase?: string; deadlineAt?: string | null };
export const NON_HOST_REFRESH_MS = 1000;
export const HOST_REFRESH_MS = 10_000;

/** Per-connection metadata only: every emitted projection authorizes its own audience afresh. */
export function createViewPoll<T extends MarkerView>(options: { id: string; initial: T; host: boolean; read: () => Promise<T>; resolvesDeadline?: (view: T) => boolean }) {
  let current = options.initial, lastRead = Date.now();
  return async (): Promise<T | null> => {
    const marker = await db().gameSession.findUnique({ where: { id: options.id }, select: { stateVersion: true } });
    if (!marker) throw new RealtimeAccessError(404);
    const due = current.phase !== 'PAUSED' && (options.resolvesDeadline?.(current) ?? true) && current.deadlineAt != null && Date.parse(current.deadlineAt) <= Date.now();
    if (marker.stateVersion === current.version && !due && Date.now() - lastRead < (options.host ? HOST_REFRESH_MS : NON_HOST_REFRESH_MS)) return null;
    const view = await options.read(); lastRead = Date.now(); const changed = view.version !== current.version; current = view;
    return changed ? view : null;
  };
}
