import { copy, current, nextCard, PartyError, redact, requirePhase, type PartyModule } from "./types";

export const secretWord: PartyModule = { slug: "secret-word", project(state, display) { const view = redact(state, display); if (display && !state.revealed && view.index < view.cards.length) { view.cards[view.index].question = "كلمة سرية عند المضيف"; view.cards[view.index].options = null; } return view; }, decide(state, action) {
  const next = copy(state); const forbidden = ((current(next).options as { forbidden?: string[] })?.forbidden ?? []).map(text => text.trim().toLocaleLowerCase("ar"));
  if (action.type === "CLUE") { requirePhase(next, "QUESTION"); const clue = action.value?.trim() ?? ""; if (!clue || clue.length > 120 || clue.toLocaleLowerCase("ar").includes(current(next).answer.toLocaleLowerCase("ar")) || forbidden.some(word => clue.toLocaleLowerCase("ar").includes(word))) throw new PartyError("التلميح يحتوي كلمة ممنوعة أو غير صالح"); next.clues.push(clue); return { state: next }; }
  if (action.type === "JUDGE") { requirePhase(next, "QUESTION"); if (action.value === "correct" && !next.teamIds.includes(action.teamId ?? "")) throw new PartyError("اختر فريقًا"); next.phase = "RESULT"; next.revealed = true; next.deadlineAt = null; return { state: next, scores: action.value === "correct" ? [{ teamId: action.teamId, delta: 100, reason: "تخمين الكلمة" }] : [] }; }
  if (action.type === "NEXT") { requirePhase(next, "RESULT"); return nextCard(next); }
  throw new PartyError("أمر غير معروف");
} };
