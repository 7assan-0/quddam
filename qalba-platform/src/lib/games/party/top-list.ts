import { copy, current, nextCard, PartyError, redact, requirePhase, type PartyModule } from "./types";

type Entry = { text: string; value: number };
export const topList: PartyModule = { slug: "top-list", project(state, display) { const view = redact(state, display); if (display && view.index < view.cards.length) view.cards[view.index].options = (state.cards[state.index].options as Entry[]).map((entry, index) => state.found.includes(index) ? entry : { text: "؟", value: 0 }); return view; }, decide(state, action) {
  const next = copy(state); const entries = current(next).options as Entry[];
  if (action.type === "GUESS") { requirePhase(next, "QUESTION"); if (!next.teamIds.includes(action.teamId ?? "")) throw new PartyError("اختر فريقًا");
    const index = entries.findIndex(entry => entry.text.trim().toLocaleLowerCase("ar") === action.value?.trim().toLocaleLowerCase("ar"));
    if (index < 0 || next.found.includes(index)) throw new PartyError("الإجابة ليست في القائمة أو كُشفت سابقًا", 409);
    next.found.push(index); if (next.found.length === entries.length) { next.phase = "RESULT"; next.revealed = true; }
    return { state: next, scores: [{ teamId: action.teamId, delta: entries[index].value, reason: "اكتشاف عنصر من القائمة" }] }; }
  if (action.type === "REVEAL") { requirePhase(next, "QUESTION"); next.phase = "RESULT"; next.revealed = true; return { state: next }; }
  if (action.type === "NEXT") { requirePhase(next, "RESULT"); return nextCard(next); }
  throw new PartyError("أمر غير معروف");
} };
