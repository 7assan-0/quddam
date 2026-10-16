import { createHash } from "node:crypto";
import { z } from "zod";
import { acceptVerifiedResult, advanceNight, nightLeaderboard, prepareNight, startNight, type NightState, type NightPlacement } from "@/lib/night/core";
import { isNightGame } from "@/lib/night/catalog";

export const SHILLA_MAX_MEMBERS = 20;
export const SHILLA_MAX_ACTIVE_INVITES = 5;
export const SHILLA_INVITE_DAYS = 7;
export const shillaCreateSchema = z.object({
  name: z.string().min(2).max(60),
  teams: z.tuple([z.string().min(2).max(60), z.string().min(2).max(60)]),
}).strict();
export const attachNightSchema = z.object({
  nightId: z.uuid(),
}).strict();
export const shillaIdSchema = z.string().uuid();
export const shillaInviteCodeSchema = z.string().regex(/^[0-9a-f]{64}$/i);
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const jsonDigest = (value: unknown) => digest(JSON.stringify(value));
export function shillaEnabled() {
  return process.env.ENABLE_NIGHT_OF_QUDDAM === "true" && process.env.ENABLE_SHILLATAK === "true";
}
export class ShillaError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}
function reject(message: string, status: number, code: string): never { throw new ShillaError(message, status, code); }
export function normalizedName(value: string) {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)) reject("اسم غير صالح", 400, "INVALID_NAME");
  const name = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const nameKey = name.toLocaleLowerCase("ar");
  if (name.length < 2 || name.length > 60 || nameKey.length > 120) reject("الاسم بين حرفين و60 حرفًا", 400, "INVALID_NAME");
  return { name, nameKey };
}
export function validateCreate(input: z.infer<typeof shillaCreateSchema>) {
  const parsed = shillaCreateSchema.safeParse(input);
  if (!parsed.success) reject("حقول الشلّة غير صالحة", 400, "INVALID_INPUT");
  const name = normalizedName(parsed.data.name);
  const teams = parsed.data.teams.map(normalizedName);
  if (teams[0].nameKey === teams[1].nameKey) reject("أسماء الفريقين يجب أن تكون مختلفة", 400, "DUPLICATE_TEAM");
  return { name: name.name, teams: teams as [{ name: string; nameKey: string }, { name: string; nameKey: string }] };
}
type VerifiedSlot = { position: number; gameSlug: string; sourceSessionId: string | null;
  resultDigest: string | null; sourceVersion: number | null; acceptedAt: Date | null; resultReceipt: unknown };
export type ShillaSnapshot = { schemaVersion: 1; nightId: string;
  teams: { shillaTeamId: string; name: string; points: number; champion: boolean }[];
  gameCount: number; sourceDigests: string[] };
/** Canonical array-based digest survives PostgreSQL JSONB key reordering. */
export function snapshotDigest(snapshot: ShillaSnapshot) {
  return jsonDigest([snapshot.schemaVersion, snapshot.nightId, snapshot.gameCount,
    snapshot.sourceDigests, snapshot.teams.map(team =>
      [team.shillaTeamId, team.name, team.points, team.champion])]);
}
const safeSourceId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const nonnegativeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const placementsSchema = z.array(z.object({ teamIds: z.array(safeSourceId).min(1).max(2) }).strict()).min(1).max(2);
const importedReceiptSchema = z.object({
  schemaVersion: z.literal(1), sourceSessionId: safeSourceId, sourceVersion: nonnegativeInteger,
  matchNumber: z.literal(1), game: z.custom<"top-list" | "ordering-challenge" | "survey-show">(isNightGame),
  placements: placementsSchema,
  scores: z.array(z.object({ nightTeamId: safeSourceId, score: nonnegativeInteger }).strict()).length(2),
  sourceDigest: sha256, digest: sha256,
}).strict();
const completedStateSchema = z.object({
  schemaVersion: z.literal(1), nightId: safeSourceId, phase: z.literal("completed"),
  version: nonnegativeInteger, currentIndex: z.literal(2),
  games: z.array(z.custom<"top-list" | "ordering-challenge" | "survey-show">(isNightGame)).length(3)
    .refine(games => new Set(games).size === 3),
  teams: z.array(z.object({ id: safeSourceId, name: z.string() })).length(2),
  results: z.array(z.object({ game: z.custom<"top-list" | "ordering-challenge" | "survey-show">(isNightGame), sourceSessionId: safeSourceId,
    placements: placementsSchema, points: z.record(z.string(), nonnegativeInteger) })).length(3),
  totals: z.record(z.string(), nonnegativeInteger),
});

/** Reconstruct the existing Night adapter's literal digest payload; JSONB key order is immaterial. */
function validImportedReceipt(input: unknown, slot: VerifiedSlot, teams: NightState["teams"]) {
  const parsed = importedReceiptSchema.safeParse(input);
  if (!parsed.success) reject("إيصال اللعبة غير مكتمل", 409, "INVALID_NIGHT_RECEIPT");
  const receipt = parsed.data;
  if (receipt.sourceSessionId !== slot.sourceSessionId || receipt.sourceVersion !== slot.sourceVersion ||
    receipt.game !== slot.gameSlug || receipt.digest !== slot.resultDigest ||
    receipt.scores.some((score, i) => score.nightTeamId !== teams[i].id))
    reject("إيصال اللعبة لا يطابق مصدره المعتمد", 409, "INVALID_NIGHT_RECEIPT");
  const payload = { schemaVersion: receipt.schemaVersion, sourceSessionId: receipt.sourceSessionId,
    sourceVersion: receipt.sourceVersion, matchNumber: receipt.matchNumber, game: receipt.game,
    placements: receipt.placements.map(p => ({ teamIds: [...p.teamIds] })),
    scores: receipt.scores.map(s => ({ nightTeamId: s.nightTeamId, score: s.score })),
    sourceDigest: receipt.sourceDigest };
  if (jsonDigest(payload) !== receipt.digest)
    reject("بصمة إيصال اللعبة غير متطابقة", 409, "INVALID_NIGHT_RECEIPT");
  const sorted = [...receipt.scores].sort((a, b) => b.score - a.score || a.nightTeamId.localeCompare(b.nightTeamId));
  const placements: NightPlacement[] = [];
  sorted.forEach((score, i) => {
    if (i && score.score === sorted[i - 1].score) placements[placements.length - 1].teamIds.push(score.nightTeamId);
    else placements.push({ teamIds: [score.nightTeamId] });
  });
  if (JSON.stringify(placements) !== JSON.stringify(receipt.placements))
    reject("ترتيب إيصال اللعبة لا يطابق نقاط المصدر", 409, "INVALID_NIGHT_RECEIPT");
  return receipt;
}
/**
 * Re-derive cumulative scores from accepted, imported Night receipts. No untrusted browser
 * points and no RSVP alias attribution. The existing Night service originally verified
 * every source engine before accepting these stored receipts. Their unkeyed digests
 * detect inconsistent audit bytes; they do not authenticate against a database administrator.
 */
export function completedSnapshot(night: {
  id: string; phase: string; stateVersion: number; state: unknown; games: VerifiedSlot[];
}, stableTeams: { id: string; name: string; position: number }[]): ShillaSnapshot {
  const parsed = completedStateSchema.safeParse(night.state);
  if (!parsed.success || parsed.data.nightId !== night.id || night.phase !== "completed" ||
      parsed.data.version !== night.stateVersion || !Array.isArray(night.games) || night.games.length !== 3 ||
      !Array.isArray(stableTeams) || stableTeams.length !== 2)
    reject("تُربط السهرة المكتملة فقط بفريقين مطابقين للشلّة", 409, "NIGHT_NOT_ELIGIBLE");
  const state: NightState = parsed.data;
  if (!state.teams.every((t, i) => normalizedName(t.name).nameKey === normalizedName(stableTeams[i]?.name ?? "").nameKey) ||
      !stableTeams.every((t,i) => t.position === i))
    reject("تُربط السهرة المكتملة فقط بفريقين مطابقين للشلّة", 409, "NIGHT_NOT_ELIGIBLE");
  let replay: NightState;
  try { replay = startNight(prepareNight({ nightId: night.id, games: state.games, teams: state.teams })); }
  catch { reject("تعذر التحقق من فرق السهرة", 409, "NIGHT_NOT_ELIGIBLE"); }
  const sourceDigests: string[] = [];
  for (let i = 0; i < 3; i++) {
    const slot = night.games[i], result = state.results[i];
    if (!slot || slot.position !== i || slot.gameSlug !== state.games[i] || !slot.sourceSessionId ||
      !slot.resultDigest || !(slot.acceptedAt instanceof Date) || !Number.isFinite(slot.acceptedAt.getTime()) || !slot.resultReceipt || !result ||
      result.game !== slot.gameSlug || result.sourceSessionId !== slot.sourceSessionId)
      reject("نتيجة سهرة غير معتمدة", 409, "INVALID_NIGHT_RECEIPT");
    const receipt = validImportedReceipt(slot.resultReceipt, slot, state.teams);
    if (JSON.stringify(receipt.placements) !== JSON.stringify(result.placements))
      reject("إيصال اللعبة لا يطابق نتيجة السهرة", 409, "INVALID_NIGHT_RECEIPT");
    try {
      if (i) replay = advanceNight(replay);
      replay = acceptVerifiedResult(replay, { game: result.game, sourceSessionId: result.sourceSessionId,
        placements: receipt.placements });
    } catch { reject("تعذر التحقق من ترتيب نتائج السهرة", 409, "INVALID_NIGHT_RECEIPT"); }
    if (state.teams.some(team => replay.results[i].points[team.id] !== result.points[team.id]))
      reject("نقاط النتيجة غير متطابقة", 409, "INVALID_NIGHT_RECEIPT");
    sourceDigests.push(slot.resultDigest);
  }
  const computed = nightLeaderboard(replay);
  if (replay.phase !== "completed" || state.currentIndex !== 2 ||
    state.teams.some(t => replay.totals[t.id] !== state.totals?.[t.id]) ||
    JSON.stringify([...computed.winnerIds].sort()) !== JSON.stringify([...nightLeaderboard(state).winnerIds].sort()))
    reject("لوحة السهرة لا تطابق الإيصالات المعتمدة", 409, "INVALID_NIGHT_RECEIPT");
  return { schemaVersion: 1, nightId: night.id, gameCount: 3, sourceDigests,
    teams: stableTeams.map((team, i) => ({ shillaTeamId: team.id, name: team.name,
      points: replay.totals[state.teams[i].id], champion: computed.winnerIds.includes(state.teams[i].id) })) };
}
export function shillaLeaderboard(stableTeams: { id: string; name: string; position: number }[],
  snapshots: ShillaSnapshot[]) {
  const teams = stableTeams.map(team => {
    const records = snapshots.map(s => s.teams.find(t => t.shillaTeamId === team.id))
      .filter((value): value is ShillaSnapshot["teams"][number] => Boolean(value));
    return { id: team.id, name: team.name, played: records.length,
      wins: records.filter(t => t.champion).length,
      points: records.reduce((sum, t) => sum + t.points, 0) };
  }).sort((a,b) => b.wins - a.wins || b.points - a.points || a.id.localeCompare(b.id));
  return teams.map(team => ({ ...team,
    rank: 1 + teams.filter(other => other.wins > team.wins ||
      (other.wins === team.wins && other.points > team.points)).length }));
}
