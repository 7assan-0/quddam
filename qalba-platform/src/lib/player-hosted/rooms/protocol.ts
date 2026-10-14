import { z } from "zod";

// Transport-independent game rules. Slot 0 is always the host; slots 1–3 are guests.
export const MAX_PLAYERS = 4;
export const MAX_ROUNDS = 100;
export const CHANNEL = "quddam-rooms-v1";
const slot = z.number().int().min(0).max(MAX_PLAYERS - 1);
const phase = z.enum(["waiting", "open", "locked", "result"]);
const stateSchema = z.object({
  protocol: z.literal(2), version: z.number().int().min(0).max(300),
  round: z.number().int().min(0).max(MAX_ROUNDS), phase,
  winner: slot.nullable(), scores: z.tuple([slotScore(), slotScore(), slotScore(), slotScore()]),
}).strict();
function slotScore() { return z.number().int().min(0).max(MAX_ROUNDS); }
export type GameState = z.infer<typeof stateSchema>;
export type HostAction = "open" | "buzz" | "award" | "skip";
export const initialState = (): GameState => ({ protocol: 2, version: 0, round: 0,
  phase: "waiting", winner: null, scores: [0, 0, 0, 0] });

export function hostAction(state: GameState, action: HostAction): GameState {
  if (action === "open" && ["waiting", "result"].includes(state.phase) && state.round < MAX_ROUNDS)
    return { ...state, version: state.version + 1, round: state.round + 1, phase: "open", winner: null };
  if (action === "buzz") return acceptBuzz(state, 0, state.round);
  if (action === "award" && state.phase === "locked" && state.winner !== null) {
    const scores = [...state.scores] as GameState["scores"];
    scores[state.winner]++;
    return { ...state, version: state.version + 1, phase: "result", scores };
  }
  if (action === "skip" && ["open", "locked"].includes(state.phase))
    return { ...state, version: state.version + 1, phase: "result" };
  return state;
}
export function acceptBuzz(state: GameState, player: number, round: number): GameState {
  if (!slot.safeParse(player).success || state.phase !== "open" || round !== state.round) return state;
  return { ...state, version: state.version + 1, phase: "locked", winner: player };
}

const intentSchema = z.object({ type: z.literal("BUZZ"), round: z.number().int().min(1).max(MAX_ROUNDS) }).strict();
export function parseIntent(raw: unknown) {
  if (typeof raw !== "string" || raw.length > 128) return null;
  try { const value = intentSchema.safeParse(JSON.parse(raw)); return value.success ? value.data : null; }
  catch { return null; }
}
export function parseSnapshot(raw: unknown): GameState | null {
  if (typeof raw !== "string" || raw.length > 1024) return null;
  try {
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const s = parsed.data, total = s.scores.reduce((a, b) => a + b, 0);
    if (s.phase === "waiting") return s.round === 0 && s.version === 0 && total === 0 && s.winner === null ? s : null;
    if (s.round < 1 || total > s.round || (s.phase !== "result" && total >= s.round)) return null;
    if (s.version < 2 * s.round - (s.phase === "open" ? 1 : 0) ||
      s.version > 3 * s.round - (s.phase === "open" ? 2 : s.phase === "locked" ? 1 : 0)) return null;
    if ((s.phase === "open" && s.winner !== null) || (s.phase === "locked" && s.winner === null)) return null;
    return s;
  } catch { return null; }
}
export function newer(current: GameState, next: GameState, lastVersion: number): boolean {
  return next.version > lastVersion && next.round >= current.round &&
    next.scores.every((score, i) => score >= current.scores[i]);
}
