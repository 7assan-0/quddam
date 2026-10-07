import { copy, current, nextCard, PartyError, redact, requirePhase, type PartyModule } from "./types";

export const bluff: PartyModule = { slug: "bluff", project(state, display) { const view = redact(state, display); if (display) { view.fakes = {}; view.votes = {}; if (state.phase === "VOTE" || state.phase === "RESULT") { const choices = [state.cards[state.index].answer, ...Object.values(state.fakes)]; view.cards[state.index].options = choices.sort((a, b) => a.localeCompare(b, "ar")); } } return view; }, decide(state, action) {
  const next = copy(state);
  if (action.type === "FAKE") { requirePhase(next, "SUBMIT"); if (!next.playerIds.includes(action.playerId ?? "") || !action.value?.trim() || next.fakes[action.playerId!]) throw new PartyError("الإجابة غير مقبولة", 409);
    if (action.value.trim() === current(next).answer) throw new PartyError("اكتب إجابة مختلفة عن الصحيحة"); next.fakes[action.playerId!] = action.value.trim().slice(0, 120); return { state: next }; }
  if (action.type === "VOTING") { requirePhase(next, "SUBMIT"); if (Object.keys(next.fakes).length !== next.playerIds.length) throw new PartyError("انتظر إجابات جميع اللاعبين", 409); next.phase = "VOTE"; return { state: next }; }
  if (action.type === "VOTE") { requirePhase(next, "VOTE"); if (!next.playerIds.includes(action.playerId ?? "") || next.votes[action.playerId!] || !action.value || (action.value !== "correct" && !next.fakes[action.value])) throw new PartyError("تصويت غير صالح", 409);
    if (action.value === action.playerId) throw new PartyError("لا يمكنك التصويت لإجابتك"); next.votes[action.playerId!] = action.value; return { state: next }; }
  if (action.type === "RESULT") { requirePhase(next, "VOTE"); if (Object.keys(next.votes).length !== next.playerIds.length) throw new PartyError("انتظر تصويت الجميع", 409);
    next.phase = "RESULT"; next.revealed = true; const scores = Object.entries(next.votes).flatMap(([voter, pick]) => pick === "correct" ? [{ playerId: voter, delta: 2, reason: "كشف الإجابة" }] : [{ playerId: pick, delta: 1, reason: "إجابة مقنعة" }]); return { state: next, scores }; }
  if (action.type === "NEXT") { requirePhase(next, "RESULT"); const result = nextCard(next); if (!result.completed) result.state.phase = "SUBMIT"; return result; }
  throw new PartyError("أمر غير معروف");
} };
