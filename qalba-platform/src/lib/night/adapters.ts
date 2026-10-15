import { createHash } from "node:crypto";
import type { NightGameSlug } from "./catalog";
import type { NightResultReceipt, NightTeamMapping } from "./types";

/** Only this narrow projection is read by the verifier; none of it is sent to a browser. */
export type NightSource = {
  id: string; hostId: string; status: string; stateVersion: number;
  startedAt: Date | null; endedAt: Date | null; creditConsumedAt: Date | null;
  gameType: { slug: string }; state: unknown;
  teams: { id: string; name: string; position: number; score: number }[];
  commands: { type: string; stateVersion: number }[];
  rankedUses: { id: string; matchNumber: number; roundIndex: number; gameRound: { endedAt: Date | null } }[];
  orderingUses: { id: string; matchNumber: number; roundIndex: number; endedAt: Date | null }[];
  surveyQuestionUses: { id: string; matchNumber: number; roundNumber: number }[];
};
export class NightVerificationError extends Error {
  constructor(message: string, readonly code = "SOURCE_NOT_VERIFIED") { super(message); }
}
function invalid(message = "نتيجة اللعبة لم تكتمل أو لا يمكن التحقق منها"): never { throw new NightVerificationError(message); }
const object = (v: unknown): Record<string, unknown> | null => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
const int = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function verifyNightOutcome(ownerId: string, game: NightGameSlug, mapping: NightTeamMapping[], source: NightSource): NightResultReceipt {
  if (source.hostId !== ownerId || source.gameType.slug !== game || source.status !== "COMPLETED" || !source.startedAt || !source.endedAt || !source.creditConsumedAt || source.endedAt < source.startedAt || !int(source.stateVersion)) invalid();
  if (!Array.isArray(mapping) || mapping.length !== 2 || new Set(mapping.map(t => t.nightTeamId)).size !== 2 || new Set(mapping.map(t => t.sourceTeamId)).size !== 2 || source.teams.length !== 2) invalid();
  for (let i = 0; i < 2; i++) {
    const m = mapping[i], t = source.teams[i];
    if (!m || m.position !== i || t.position !== i || t.id !== m.sourceTeamId || t.name !== m.name || !int(t.score)) invalid("هوية الفريق أو نتيجته لا تطابق الربط المحفوظ");
  }
  const s = object(source.state);
  const expected = { "top-list": ["RANKED_LIST", 5], "ordering-challenge": ["ORDERING", 7], "survey-show": ["SURVEY_BATTLE", 5] } as const;
  const [module, rounds] = expected[game];
  if (!s || s.module !== module || s.schemaVersion !== 1 || s.phase !== "COMPLETED" || s.matchNumber !== 1 || s.roundIndex !== rounds - 1 || !same(s.teamIds, mapping.map(t => t.sourceTeamId)) || !same(s.scores, source.teams.map(t => t.score)) || !Array.isArray(s.useIds) || s.useIds.length !== rounds || s.useIds.some(id => typeof id !== "string" || !id) || new Set(s.useIds).size !== rounds) invalid();
  const uses = game === "top-list" ? source.rankedUses : game === "ordering-challenge" ? source.orderingUses : source.surveyQuestionUses;
  if (!Array.isArray(uses) || uses.length !== rounds || uses.some((u, i) => u.id !== (s.useIds as string[])[i] || u.matchNumber !== 1 || ("roundIndex" in u ? u.roundIndex !== i : u.roundNumber !== i + 1) || ("gameRound" in u && !u.gameRound.endedAt) || ("endedAt" in u && !u.endedAt))) invalid();
  const commands = source.commands;
  if (commands.filter(c => c.type === "START").length !== 1 || commands.some(c => c.type === "REMATCH") || commands.at(-1)?.type !== "COMPLETE" || commands.at(-1)?.stateVersion !== source.stateVersion) invalid();
  // END_GAME can finish an intentionally shortened match. This MVP imports only a full normal traversal.
  if (commands.some(c => c.type === "END_GAME")) invalid("المباراة المنهاة يدويًا تحتاج تحققًا مستقلًا؛ أكمل جميع الجولات بالطريقة المعتادة");
  if (game === "top-list") {
    if (!Array.isArray(s.results) || s.results.length !== rounds) invalid();
    const totals = [0, 0];
    for (const [i, raw] of s.results.entries()) {
      const r = object(raw);
      if (!r || r.round !== i + 1 || !Array.isArray(r.points) || r.points.length !== 2 || !r.points.every(int) || !Array.isArray(r.found) || r.found.length !== 2 || !r.found.every(int)) invalid();
      totals[0] += r.points[0]; totals[1] += r.points[1];
    }
    if (!same(totals, s.scores)) invalid();
  } else if (game === "ordering-challenge") {
    if (s.roundCount !== rounds || !Array.isArray(s.results) || s.results.length !== rounds) invalid();
    const totals = [0, 0];
    for (const [i, raw] of s.results.entries()) {
      const r = object(raw);
      if (!r || r.roundNumber !== i + 1 || !Array.isArray(r.metrics) || r.metrics.length !== 2 || typeof r.voided !== "boolean" || !["SUBMITTED", "TIMEOUT", "MANUAL_END"].includes(String(r.reason))) invalid();
      for (let t = 0; t < 2; t++) { const m = object(r.metrics[t]); if (!m || !int(m.totalPoints) || !int(m.exactMatches) || !int(m.perfectBonus) || !int(m.positionError)) invalid(); if (!r.voided) totals[t] += m.totalPoints; }
    }
    if (!same(totals, s.scores)) invalid();
  } else {
    if (!same(s.multipliers, [1, 1, 2, 2, 3]) || commands.filter(c => c.type === "NEXT_ROUND").length < rounds || typeof s.roundWinnerId !== "string" || !mapping.some(t => t.sourceTeamId === s.roundWinnerId)) invalid();
    // Survey's canonical module has no results array. Each NEXT requires ROUND_RESULTS;
    // no END_GAME and match1 plus the final round prove all five normal awards occurred.
  }
  const scores = mapping.map((m, i) => ({ nightTeamId: m.nightTeamId, score: source.teams[i].score }));
  const sorted = [...scores].sort((a, b) => b.score - a.score || a.nightTeamId.localeCompare(b.nightTeamId));
  const placements: { teamIds: string[] }[] = [];
  for (const row of sorted) {
    const previous = sorted[sorted.indexOf(row) - 1];
    if (previous && previous.score === row.score) placements[placements.length - 1].teamIds.push(row.nightTeamId);
    else placements.push({ teamIds: [row.nightTeamId] });
  }
  const sourceDigest = createHash("sha256").update(JSON.stringify({ id: source.id, hostId: source.hostId, game, status: source.status, startedAt: source.startedAt, endedAt: source.endedAt, creditConsumedAt: source.creditConsumedAt, state: source.state, teams: source.teams, commands, uses })).digest("hex");
  const receipt = { schemaVersion: 1 as const, sourceSessionId: source.id, sourceVersion: source.stateVersion, matchNumber: 1 as const, game, placements, scores, sourceDigest };
  return { ...receipt, digest: createHash("sha256").update(JSON.stringify(receipt)).digest("hex") };
}
