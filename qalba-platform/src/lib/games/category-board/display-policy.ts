export const DISPLAY_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
export const DISPLAY_COMPLETED_GRACE_MS = 30 * 60 * 1000;
export const DISPLAY_LINK_WINDOW_MS = 10 * 60 * 1000;
export const DISPLAY_LINKS_PER_WINDOW = 6;
export const DISPLAY_ACTIVE_LINK_LIMIT = 3;

/** Completed score judgments remain observable because their final move can be undone. */
export function displayWatchFinished(view: { status: string; canUndo: boolean }) {
  return (view.status === "COMPLETED" || view.status === "ABANDONED") && !view.canUndo;
}

export function displayWindowEndsAt(endedAt: Date | null, now: Date): Date | null {
  if (!endedAt) return null;
  const endsAt = new Date(endedAt.getTime() + DISPLAY_COMPLETED_GRACE_MS);
  return endsAt.getTime() > now.getTime() ? endsAt : null;
}

export function displayAccessValid(access: { expiresAt: Date; revokedAt: Date | null },
  session: { endedAt: Date | null }, now: Date): boolean {
  return !access.revokedAt && access.expiresAt.getTime() > now.getTime() &&
    (!session.endedAt || Boolean(displayWindowEndsAt(session.endedAt, now)));
}
