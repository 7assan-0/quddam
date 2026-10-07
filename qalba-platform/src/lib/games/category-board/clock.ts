/** Convert the server timestamp to the viewer's local clock, compensating for network round trip. */
export function serverOffsetMs(serverNow: string, receivedAtMs: number, sentAtMs = receivedAtMs): number {
  return Date.parse(serverNow) + Math.max(0, receivedAtMs - sentAtMs) / 2 - receivedAtMs;
}

export function localNowMs(): number { return Date.now(); }

export function remainingOnClient(deadlineAt: string | null, remainingMs: number, localNowMs: number, offsetMs: number): number {
  return deadlineAt ? Math.max(0, Date.parse(deadlineAt) - (localNowMs + offsetMs)) : remainingMs;
}
