import { copy, current, nextCard, PartyError, redact, requirePhase, type PartyModule } from "./types";

export const fastestMind: PartyModule = { slug: "fastest-mind", project: redact, decide(state, action) {
  const next = copy(state);
  if (action.type === "ANSWER") { requirePhase(next, "QUESTION"); if (!next.teamIds.includes(action.teamId ?? "") && !next.playerIds.includes(action.playerId ?? "")) throw new PartyError("اختر مشاركًا");
    if (next.deadlineAt && new Date(next.deadlineAt).getTime() < Date.now()) throw new PartyError("انتهى الوقت", 409);
    const normalized = (text: string) => text.trim().toLocaleLowerCase("ar"); const correct = normalized(action.value ?? "") === normalized(current(next).answer) || current(next).alternativeAnswers.some(text => normalized(text) === normalized(action.value ?? ""));
    const bonus = next.deadlineAt ? Math.ceil(Math.max(0, new Date(next.deadlineAt).getTime() - Date.now()) / 1000) : 0;
    next.phase = "RESULT"; next.revealed = true; next.deadlineAt = null; return { state: next, scores: correct ? [{ teamId: action.teamId, playerId: action.playerId, delta: 100 + bonus, reason: "إجابة سريعة صحيحة" }] : [] }; }
  if (action.type === "TIMEOUT") { requirePhase(next, "QUESTION"); if (!next.deadlineAt || new Date(next.deadlineAt).getTime() > Date.now()) throw new PartyError("لم ينته الوقت", 409); next.phase = "RESULT"; next.revealed = true; next.deadlineAt = null; return { state: next }; }
  if (action.type === "NEXT") { requirePhase(next, "RESULT"); return nextCard(next); }
  throw new PartyError("أمر غير معروف");
} };
