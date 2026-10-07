export const partySlugs = ["letter-battle", "bluff", "fastest-mind", "top-list", "secret-word", "survey-show", "party-court"] as const;
export type PartySlug = typeof partySlugs[number];
export type Card = { id: string; question: string; answer: string; type: string; options: unknown; alternativeAnswers: string[]; pointValue: number };
export type PartyAction = { type: string; teamId?: string; playerId?: string; value?: string; index?: number; seconds?: number };
export type PartyState = { schemaVersion: 1; slug: PartySlug; cards: Card[]; index: number; phase: string; revealed: boolean;
  teamIds: string[]; playerIds: string[]; timerSeconds: number; deadlineAt: string | null; remainingMs: number;
  turn: number; owners: (string | null)[]; selected: number | null; found: number[]; strikes: number;
  fakes: Record<string, string>; votes: Record<string, string>; clues: string[]; winnerId: string | null; lastCapture: number | null };
export type Score = { teamId?: string; playerId?: string; delta: number; reason: string };
export type Decision = { state: PartyState; scores?: Score[]; opened?: string; completed?: boolean };
export class PartyError extends Error { constructor(message: string, public status = 400) { super(message); } }
export interface PartyModule { slug: PartySlug; decide(state: PartyState, action: PartyAction): Decision; project(state: PartyState, display: boolean): PartyState; }
export function current(state: PartyState) { return state.cards[state.index]; }
export function requirePhase(state: PartyState, ...phases: string[]) { if (!phases.includes(state.phase)) throw new PartyError("هذا الإجراء غير متاح الآن", 409); }
export function copy(state: PartyState): PartyState { return structuredClone(state); }
export function nextCard(state: PartyState): Decision {
  const next = copy(state); next.index++; next.revealed = false; next.deadlineAt = null; next.remainingMs = next.timerSeconds * 1000;
  next.fakes = {}; next.votes = {}; next.clues = []; next.found = []; next.strikes = 0; next.selected = null;
  if (next.index >= next.cards.length) { next.phase = "DONE"; return { state: next, completed: true }; }
  next.phase = "QUESTION"; return { state: next, opened: current(next).id };
}
export function redact(state: PartyState, display: boolean): PartyState {
  const view = copy(state);
  if (display) view.cards = view.cards.map((card, index) => index === view.index && state.phase !== "LOBBY" ? { ...card, answer: state.revealed ? card.answer : "", alternativeAnswers: state.revealed ? card.alternativeAnswers : [], options: card.options } : { ...card, question: "", answer: "", alternativeAnswers: [], options: null });
  return view;
}
export function timer(state: PartyState, action: PartyAction): Decision | null {
  if (action.type !== "TIMER") return null;
  requirePhase(state, "QUESTION", "SUBMIT", "VOTE", "ARGUE");
  const next = copy(state);
  if (next.deadlineAt) { next.remainingMs = Math.max(0, new Date(next.deadlineAt).getTime() - Date.now()); next.deadlineAt = null; }
  else next.deadlineAt = new Date(Date.now() + (next.remainingMs || next.timerSeconds * 1000)).toISOString();
  return { state: next };
}
