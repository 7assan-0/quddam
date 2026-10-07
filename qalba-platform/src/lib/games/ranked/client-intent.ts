import type { RankedView } from './service';
import type { Action } from './module';
export type RankedIntentView = Pick<RankedView, 'id' | 'version' | 'matchNumber' | 'roundNumber' | 'phase' | 'pausedPhase' | 'activeTeamId' | 'attempts'>;
export type RankedPendingIntent = { key: string; payload: string; scope: string; expectedVersion: number };
function scope(view: RankedIntentView) {
 return JSON.stringify([view.id, view.matchNumber, view.roundNumber, view.phase, view.pausedPhase, view.activeTeamId, view.attempts, view.version]);
}
/** Ranked versions change only for committed commands/deadlines, not SSE heartbeats,
 * display access or admin edits. A newer version makes an old unresolved intent obsolete. */
export function createRankedIntentTracker(initial: RankedIntentView, newKey = () => crypto.randomUUID()) {
 let current = initial, pending: RankedPendingIntent | null = null;
 return {
  observe(next: RankedIntentView) {
   if (next.id !== current.id || next.version < current.version) return false;
   if (pending && pending.scope !== scope(next)) pending = null;
   current = next; return true;
  },
  begin(action: Action) {
   const payload = JSON.stringify(action), identity = scope(current);
   if (!pending || pending.payload !== payload || pending.scope !== identity) pending = { payload, scope: identity, key: newKey(), expectedVersion: current.version };
   return pending;
  },
  finish(intent: RankedPendingIntent) { if (pending === intent) pending = null; },
  clear() { pending = null; },
 };
}
