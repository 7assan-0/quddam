export const CONTROLLER_ACTIVE_LINKS_PER_TEAM = 1;
export const CONTROLLER_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
export const CONTROLLER_LINK_WINDOW_MS = 10 * 60 * 1000;
export const CONTROLLER_LINKS_PER_WINDOW = 6;
export function controllerAccessValid(a: { sessionId: string; teamId: string; matchNumber: number; revokedAt: Date | null; expiresAt: Date }, session: { id: string }, state: { teamIds: string[]; matchNumber: number; phase: string }, now: number) { return a.sessionId === session.id && state.teamIds.includes(a.teamId) && a.matchNumber === state.matchNumber && !a.revokedAt && a.expiresAt.getTime() > now && state.phase !== 'ABANDONED'; }
