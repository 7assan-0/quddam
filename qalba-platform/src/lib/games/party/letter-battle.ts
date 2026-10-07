import { copy, current, PartyError, redact, requirePhase, type PartyModule } from "./types";

export function hasRoute(owners: (string | null)[], teamId: string, vertical: boolean, width = 4) {
  const start = owners.flatMap((owner, index) => owner === teamId && (vertical ? index < width : index % width === 0) ? [index] : []);
  const seen = new Set(start); const queue = [...start];
  while (queue.length) {
    const index = queue.shift()!;
    if (vertical ? index >= owners.length - width : index % width === width - 1) return true;
    for (const adjacent of [index - width, index + width, ...(index % width ? [index - 1] : []), ...(index % width < width - 1 ? [index + 1] : [])]) {
      if (adjacent >= 0 && adjacent < owners.length && owners[adjacent] === teamId && !seen.has(adjacent)) { seen.add(adjacent); queue.push(adjacent); }
    }
  }
  return false;
}

export const letterBattle: PartyModule = { slug: "letter-battle", project(state, display) { const view = redact(state, display);
  if (display) for (let index = 0; index < state.owners.length; index++) view.cards[index].options = { letter: (state.cards[index].options as { letter: string }).letter };
  return view; }, decide(state, action) {
  const next = copy(state);
  if (action.type === "OPEN") { requirePhase(next, "BOARD"); if (!Number.isInteger(action.index) || action.index! < 0 || action.index! >= next.owners.length || next.owners[action.index!] || next.selected !== null) throw new PartyError("الخانة غير متاحة", 409);
    next.selected = action.index!; next.index = action.index!; next.phase = "QUESTION"; next.revealed = false; return { state: next, opened: current(next).id }; }
  if (action.type === "REVEAL") { requirePhase(next, "QUESTION"); next.revealed = true; return { state: next }; }
  if (action.type === "CAPTURE") { requirePhase(next, "QUESTION"); if (!next.teamIds.includes(action.teamId ?? "")) throw new PartyError("اختر فريقًا");
    next.owners[next.selected!] = action.teamId!; next.lastCapture = next.selected; next.selected = null; next.phase = "BOARD"; next.revealed = false; next.deadlineAt = null;
    if (hasRoute(next.owners, action.teamId!, next.teamIds[0] === action.teamId)) { next.winnerId = action.teamId!; next.phase = "DONE"; }
    return { state: next, scores: [{ teamId: action.teamId!, delta: 100, reason: "احتلال حرف" }], completed: next.phase === "DONE" }; }
  if (action.type === "SKIP") { requirePhase(next, "QUESTION"); next.selected = null; next.phase = "BOARD"; next.deadlineAt = null; return { state: next }; }
  if (action.type === "REPLACE") { requirePhase(next, "QUESTION"); const cell = next.selected!; const letter = (next.cards[cell].options as { letter: string }).letter;
    const spare = next.cards.find((card, index) => index >= next.owners.length && (card.options as { letter: string }).letter === letter && !next.cards.slice(0, next.owners.length).some(q => q.id === card.id));
    if (!spare) throw new PartyError("لا يوجد سؤال بديل لهذا الحرف", 409);
    next.cards[cell] = spare; next.revealed = false; return { state: next, opened: spare.id }; }
  if (action.type === "UNDO") { requirePhase(next, "BOARD", "DONE"); if (next.lastCapture === null) throw new PartyError("لا يوجد احتلال للتراجع عنه", 409);
    const index = next.lastCapture; const teamId = next.owners[index]!; next.owners[index] = null; next.lastCapture = null; next.winnerId = null; next.phase = "BOARD"; return { state: next, scores: [{ teamId, delta: -100, reason: "تراجع عن احتلال" }] }; }
  throw new PartyError("أمر غير معروف");
} };
