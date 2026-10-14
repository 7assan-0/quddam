/**
 * Isolated, browser-only Player-Hosted buzzer laboratory.
 * Do not import this into the production Lightning or billing flows.
 * The host owns the state. Peers may only submit a bounded BUZZ intent.
 */
export type LabPhase = "waiting" | "open" | "locked" | "result";
export type LabState = {
  protocol: 1;
  version: number;
  round: number;
  phase: LabPhase;
  winner: 0 | 1 | null;
  scores: [number, number];
};
export type GuestIntent = { type: "BUZZ"; round: number };

export const initialLabState = (): LabState => ({
  protocol: 1, version: 0, round: 0, phase: "waiting", winner: null, scores: [0, 0],
});

export function openRound(state: LabState): LabState {
  if (state.phase === "open" || state.phase === "locked" || state.round >= 100) return state;
  return { ...state, version: state.version + 1, round: state.round + 1, phase: "open", winner: null };
}

export function buzz(state: LabState, team: 0 | 1, round: number): LabState {
  if (state.phase !== "open" || round !== state.round || state.winner !== null) return state;
  return { ...state, version: state.version + 1, phase: "locked", winner: team };
}

export function awardPoint(state: LabState): LabState {
  if (state.phase !== "locked" || state.winner === null) return state;
  const scores: [number, number] = [...state.scores];
  scores[state.winner] += 1;
  return { ...state, version: state.version + 1, phase: "result", scores };
}

export function skipRound(state: LabState): LabState {
  if (state.phase !== "locked" && state.phase !== "open") return state;
  return { ...state, version: state.version + 1, phase: "result" };
}

/** The only accepted peer-to-host message. A guest cannot send scores or host actions. */
export function parseGuestIntent(raw: unknown): GuestIntent | null {
  if (typeof raw !== "string" || raw.length > 128) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length !== 2 || obj.type !== "BUZZ" || !Number.isSafeInteger(obj.round)) return null;
    if (typeof obj.round !== "number" || obj.round < 1 || obj.round > 100) return null;
    return { type: "BUZZ", round: obj.round };
  } catch { return null; }
}

/** Guest accepts snapshots only from the connected host; validate before rendering. */
export function parseHostSnapshot(raw: unknown): LabState | null {
  if (typeof raw !== "string" || raw.length > 1024) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).sort().join(",") !== "phase,protocol,round,scores,version,winner") return null;
    const { protocol, version, round, phase, winner, scores } = obj;
    if (protocol !== 1 || !Number.isSafeInteger(version) || typeof version !== "number" || version < 0) return null;
    if (!Number.isSafeInteger(round) || typeof round !== "number" || round < 0 || round > 100) return null;
    if (!["waiting", "open", "locked", "result"].includes(String(phase))) return null;
    if (winner !== null && winner !== 0 && winner !== 1) return null;
    if (!Array.isArray(scores) || scores.length !== 2 || !scores.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 100)) return null;
    if ((phase === "waiting" || phase === "open") && winner !== null) return null;
    if (phase === "locked" && winner === null) return null;
    if (round === 0 && phase !== "waiting") return null;
    return { protocol: 1, version, round, phase: phase as LabPhase, winner: winner as 0 | 1 | null, scores: [scores[0], scores[1]] };
  } catch { return null; }
}

/** SDP copy/paste is for trusted testers, never put it in URLs, logs or GitHub. */
export function parseSessionDescription(raw: string, expected: "offer" | "answer"): RTCSessionDescriptionInit {
  if (raw.length > 100_000) throw new Error("رسالة الاتصال أطول من المسموح");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("رسالة الاتصال ليست JSON صالحًا"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("رسالة الاتصال غير صالحة");
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).sort().join(",") !== "sdp,type" || obj.type !== expected ||
    typeof obj.sdp !== "string" || obj.sdp.length < 20 || obj.sdp.length > 95_000 ||
    !obj.sdp.startsWith("v=0\r\n")) throw new Error("نوع رسالة الاتصال أو محتواها غير صالح");
  return { type: expected, sdp: obj.sdp };
}
