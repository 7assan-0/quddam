import { copy, current, nextCard, PartyError, redact, requirePhase, type PartyModule } from "./types";

type Entry = { text: string; value: number };
export const surveyShow: PartyModule = { slug: "survey-show", project(state, display) { const view = redact(state, display); if (display && view.index < view.cards.length) view.cards[view.index].options = (state.cards[state.index].options as Entry[]).map((entry, index) => state.found.includes(index) || state.revealed ? entry : { text: "؟", value: 0 }); return view; }, decide(state, action) {
  const next = copy(state); const entries = current(next).options as Entry[];
  if (action.type === "GUESS") { requirePhase(next, "QUESTION", "STEAL"); if (!next.teamIds.includes(action.teamId ?? "")) throw new PartyError("اختر فريقًا");
    const index = entries.findIndex(entry => entry.text.trim().toLocaleLowerCase("ar") === action.value?.trim().toLocaleLowerCase("ar"));
    if (index >= 0 && !next.found.includes(index)) { next.found.push(index); if (next.phase === "STEAL" || next.found.length === entries.length) { next.phase = "RESULT"; next.revealed = true; }
      const multiplier = next.index + 1; return { state: next, scores: [{ teamId: action.teamId, delta: entries[index].value * multiplier, reason: "إجابة من الجمهور" }] }; }
    if (index >= 0) throw new PartyError("الإجابة كُشفت سابقًا", 409);
    next.strikes++; if (next.phase === "STEAL") { next.phase = "RESULT"; next.revealed = true; }
    else if (next.strikes >= 3) next.phase = "STEAL"; return { state: next }; }
  if (action.type === "REVEAL") { requirePhase(next, "QUESTION", "STEAL"); next.phase = "RESULT"; next.revealed = true; return { state: next }; }
  if (action.type === "NEXT") { requirePhase(next, "RESULT"); return nextCard(next); }
  throw new PartyError("أمر غير معروف");
} };
