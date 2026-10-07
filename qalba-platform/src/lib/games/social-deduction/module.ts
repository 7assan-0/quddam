export type Phase = "LOBBY" | "ROLE_REVEAL" | "DISCUSSION" | "VOTING" | "RUNOFF_VOTING" | "OUTSIDER_GUESS" | "RESULTS" | "COMPLETED" | "ABANDONED" | "PAUSED";
export type Winner = "PLAYERS" | "OUTSIDER";
export const GUESS_TIMER_SECONDS = 30;
export type SocialState = {
  schemaVersion: 1; phase: Phase; pausedPhase: Phase | null; turnIndex: number;
  timerSeconds: number; deadlineAt: string | null; remainingMs: number;
  ballot: number; candidates: string[]; maxRunoffs: number; allowVoteChange: boolean;
  tally: { targetId: string; count: number }[] | null; suspectedId: string | null;
  winner: Winner | null; reason: string | null;
};
export class SocialError extends Error {
  constructor(message: string, public status = 409, public code = "GAME_RULE_ERROR") { super(message); }
}
export const assertPhase = (state: SocialState, ...phases: Phase[]) => {
  if (!phases.includes(state.phase)) throw new SocialError("هذا الإجراء غير متاح في المرحلة الحالية", 409, "INVALID_TRANSITION");
};
export function initialState(timerSeconds: number): SocialState {
  return { schemaVersion: 1, phase: "LOBBY", pausedPhase: null, turnIndex: 0, timerSeconds,
    deadlineAt: null, remainingMs: timerSeconds * 1000, ballot: 0, candidates: [], maxRunoffs: 2,
    allowVoteChange: true, tally: null, suspectedId: null, winner: null, reason: null };
}
export function startRound(state: SocialState, participantIds: string[]): SocialState {
  assertPhase(state, "LOBBY", "COMPLETED");
  if (participantIds.length < 3 || participantIds.length > 12) throw new SocialError("يلزم ٣ إلى ١٢ لاعبًا", 400, "INVALID_PLAYER_COUNT");
  return { ...initialState(state.timerSeconds), phase: "ROLE_REVEAL", candidates: participantIds };
}
export function beginDiscussion(state: SocialState, now: number): SocialState {
  assertPhase(state, "ROLE_REVEAL");
  return { ...state, phase: "DISCUSSION", deadlineAt: new Date(now + state.timerSeconds * 1000).toISOString(), remainingMs: state.timerSeconds * 1000 };
}
export function advanceTurn(state: SocialState, count: number, now: number): SocialState {
  assertPhase(state, "DISCUSSION");
  if (state.turnIndex + 1 >= count) return beginVoting(state);
  return { ...state, turnIndex: state.turnIndex + 1, deadlineAt: new Date(now + state.timerSeconds * 1000).toISOString(), remainingMs: state.timerSeconds * 1000 };
}
export function beginVoting(state: SocialState): SocialState {
  assertPhase(state, "DISCUSSION");
  return { ...state, phase: "VOTING", ballot: 1, deadlineAt: null, remainingMs: 0, tally: null };
}
export function pause(state: SocialState, now: number): SocialState {
  assertPhase(state, "ROLE_REVEAL", "DISCUSSION", "VOTING", "RUNOFF_VOTING", "OUTSIDER_GUESS");
  if (state.phase === "OUTSIDER_GUESS" && state.deadlineAt && new Date(state.deadlineAt).getTime() <= now)
    throw new SocialError("انتهت مهلة التخمين", 409, "GUESS_TIMEOUT");
  return { ...state, pausedPhase: state.phase, phase: "PAUSED", remainingMs: state.deadlineAt ? Math.max(0, new Date(state.deadlineAt).getTime() - now) : state.remainingMs, deadlineAt: null };
}
export function resume(state: SocialState, now: number): SocialState {
  assertPhase(state, "PAUSED");
  if (!state.pausedPhase) throw new SocialError("حالة الإيقاف غير صحيحة", 409);
  return { ...state, phase: state.pausedPhase, pausedPhase: null,
    deadlineAt: ["DISCUSSION", "OUTSIDER_GUESS"].includes(state.pausedPhase) ? new Date(now + state.remainingMs).toISOString() : null };
}
export function validateVote(state: SocialState, voterId: string, targetId: string, participantIds: string[]) {
  assertPhase(state, "VOTING", "RUNOFF_VOTING");
  if (!participantIds.includes(voterId) || !participantIds.includes(targetId) || !state.candidates.includes(targetId) || voterId === targetId)
    throw new SocialError("اختيار التصويت غير صالح", 400, "INVALID_VOTE");
}
export function resolveBallot(state: SocialState, targetIds: string[], outsiderId: string, now: number): SocialState {
  assertPhase(state, "VOTING", "RUNOFF_VOTING");
  const tally = state.candidates.map((targetId) => ({ targetId, count: targetIds.filter((id) => id === targetId).length }));
  const max = Math.max(0, ...tally.map((item) => item.count));
  const leaders = tally.filter((item) => item.count === max).map((item) => item.targetId);
  if (leaders.length > 1 && state.ballot <= state.maxRunoffs && max > 0) {
    return { ...state, phase: "RUNOFF_VOTING", candidates: leaders, ballot: state.ballot + 1, tally, suspectedId: null };
  }
  if (leaders.length !== 1 || max === 0) return { ...state, phase: "RESULTS", tally, suspectedId: null, winner: "OUTSIDER", reason: "UNRESOLVED_TIE" };
  const suspectedId = leaders[0];
  return suspectedId === outsiderId
    ? { ...state, phase: "OUTSIDER_GUESS", tally, suspectedId,
      deadlineAt: new Date(now + GUESS_TIMER_SECONDS * 1000).toISOString(), remainingMs: GUESS_TIMER_SECONDS * 1000 }
    : { ...state, phase: "RESULTS", tally, suspectedId, winner: "OUTSIDER", reason: "WRONG_SUSPECT" };
}
export function normalizeArabic(value: string): string {
  return value.normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .trim().replace(/\s+/g, " ").toLocaleLowerCase("ar");
}
export function guessResult(state: SocialState, guess: string, accepted: string[], now: number): SocialState {
  assertPhase(state, "OUTSIDER_GUESS");
  if (!state.deadlineAt || new Date(state.deadlineAt).getTime() <= now)
    throw new SocialError("انتهت مهلة التخمين", 409, "GUESS_TIMEOUT");
  const match = accepted.some((word) => normalizeArabic(word) === normalizeArabic(guess));
  return { ...state, phase: "RESULTS", deadlineAt: null, remainingMs: 0,
    winner: match ? "OUTSIDER" : "PLAYERS", reason: match ? "CORRECT_GUESS" : "WRONG_GUESS" };
}
export function timeoutGuess(state: SocialState, now: number): SocialState {
  assertPhase(state, "OUTSIDER_GUESS");
  if (!state.deadlineAt || new Date(state.deadlineAt).getTime() > now)
    throw new SocialError("لم تنتهِ مهلة التخمين بعد", 409, "GUESS_NOT_EXPIRED");
  return { ...state, phase: "RESULTS", deadlineAt: null, remainingMs: 0, winner: "PLAYERS", reason: "GUESS_TIMEOUT" };
}
