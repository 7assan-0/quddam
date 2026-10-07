export type QuestionCandidate = { id: string; difficulty: string; categoryId: string };
export type PlayedQuestion = { questionId: string; lastPlayedAt: Date };

/** Prefer unused questions; widen to least-recently played only after the bank is exhausted. */
export function selectQuestion<T extends QuestionCandidate>(
  candidates: T[],
  history: PlayedQuestion[],
  usedInSession: ReadonlySet<string>,
  random: () => number = Math.random,
): T | null {
  const available = candidates.filter((q) => !usedInSession.has(q.id));
  if (!available.length) return null;
  const played = new Map(history.map((entry) => [entry.questionId, entry.lastPlayedAt.getTime()]));
  const fresh = available.filter((q) => !played.has(q.id));
  if (fresh.length) return fresh[Math.floor(random() * fresh.length)];
  const oldest = Math.min(...available.map((q) => played.get(q.id) ?? Infinity));
  const leastRecent = available.filter((q) => played.get(q.id) === oldest);
  return leastRecent[Math.floor(random() * leastRecent.length)];
}
