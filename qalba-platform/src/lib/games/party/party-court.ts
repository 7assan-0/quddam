import { copy, nextCard, PartyError, redact, requirePhase, type PartyModule } from "./types";

export const partyCourt: PartyModule = { slug: "party-court", project(state, display) { const view = redact(state, display); if (display && !state.revealed) view.votes = {}; return view; }, decide(state, action) {
  const next = copy(state);
  if (action.type === "VOTING") { requirePhase(next, "ARGUE"); next.phase = "VOTE"; next.deadlineAt = null; return { state: next }; }
  if (action.type === "VOTE") { requirePhase(next, "VOTE"); if (!next.playerIds.includes(action.playerId ?? "") || next.votes[action.playerId!] || !["prosecution", "defense"].includes(action.value ?? "")) throw new PartyError("تصويت غير صالح", 409); next.votes[action.playerId!] = action.value!; return { state: next }; }
  if (action.type === "RESULT") { requirePhase(next, "VOTE"); if (Object.keys(next.votes).length !== next.playerIds.length) throw new PartyError("انتظر تصويت الجميع", 409);
    const prosecution = Object.values(next.votes).filter(value => value === "prosecution").length; const winner = prosecution > next.playerIds.length / 2 ? next.teamIds[0] : next.teamIds[1]; next.winnerId = winner; next.phase = "RESULT"; next.revealed = true;
    return { state: next, scores: [{ teamId: winner, delta: 100, reason: "حكم المحكمة" }] }; }
  if (action.type === "NEXT") { requirePhase(next, "RESULT"); const result = nextCard(next); result.state.winnerId = null; if (!result.completed) result.state.phase = "ARGUE"; return result; }
  if (action.type === "REVEAL") { requirePhase(next, "ARGUE", "VOTE"); next.revealed = true; return { state: next }; }
  throw new PartyError("أمر غير معروف");
} };
