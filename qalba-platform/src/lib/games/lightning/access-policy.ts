export const BUZZER_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
export const BUZZER_LINK_WINDOW_MS = 10 * 60 * 1000;
export const BUZZER_LINKS_PER_WINDOW = 6;
export const BUZZER_ACTIVE_LINKS_PER_TEAM = 1;
export function buzzerAccessValid(access: { sessionId: string; teamId: string; matchNumber: number; expiresAt: Date; revokedAt: Date | null }, session: { id: string; endedAt: Date | null }, state: { matchNumber: number; teamIds: string[] }, now: number) {
  return access.sessionId === session.id && access.matchNumber === state.matchNumber && state.teamIds.includes(access.teamId) && !session.endedAt && !access.revokedAt && access.expiresAt.getTime() > now;
}
