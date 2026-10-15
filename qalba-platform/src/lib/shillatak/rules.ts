import { createHash } from "node:crypto";
import { z } from "zod";
import { acceptVerifiedResult, advanceNight, nightLeaderboard, prepareNight, startNight, type NightState, type NightPlacement } from "@/lib/night/core";

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
  const name = normalizedName(input.name);
  const teams = input.teams.map(normalizedName);
  if (teams[0].nameKey === teams[1].nameKey) reject("أسماء الفريقين يجب أن تكون مختلفة", 400, "DUPLICATE_TEAM");
  return { name: name.name, teams: teams as [{ name: string; nameKey: string }, { name: string; nameKey: string }] };
}
type VerifiedSlot = { position: number; gameSlug: string; sourceSessionId: string | null;
  resultDigest: string | null; acceptedAt: Date | null; resultReceipt: unknown };
export type ShillaSnapshot = { schemaVersion: 1; nightId: string;
  teams: { shillaTeamId: string; name: string; points: number; champion: boolean }[];
  gameCount: number; sourceDigests: string[] };
/**
 * Re-derive cumulative scores from frozen, imported Night receipts. No untrusted browser
 * points and no RSVP alias attribution. The existing Night service originally verified
 * every source engine before accepting these immutable receipts.
 */
export function completedSnapshot(night: {
  id: string; phase: string; stateVersion: number; state: unknown; games: VerifiedSlot[];
}, stableTeams: { id: string; name: string; position: number }[]): ShillaSnapshot {
  const state = night.state as NightState;
  if (!state || state.schemaVersion !== 1 || state.nightId !== night.id || state.phase !== "completed" ||
      night.phase !== "completed" || state.version !== night.stateVersion ||
      state.teams?.length !== 2 || state.games?.length !== 3 || state.results?.length !== 3 ||
      night.games.length !== 3 || stableTeams.length !== 2 ||
      !Array.isArray(state.results) || !state.teams.every((t, i) => normalizedName(t.name).nameKey === normalizedName(stableTeams[i]?.name ?? "").nameKey) ||
      !stableTeams.every((t,i) => t.position === i))
    reject("تُربط السهرة المكتملة فقط بفريقين مطابقين للشلّة", 409, "NIGHT_NOT_ELIGIBLE");
  const fresh = startNight(prepareNight({ nightId: night.id, games: state.games, teams: state.teams }));
  let replay = fresh;
  const sourceDigests: string[] = [];
  for (let i = 0; i < 3; i++) {
    const slot = night.games[i], result = state.results[i];
    if (!slot || slot.position !== i || slot.gameSlug !== state.games[i] || !slot.sourceSessionId ||
      !slot.resultDigest || !slot.acceptedAt || !slot.resultReceipt || !result ||
      result.game !== slot.gameSlug || result.sourceSessionId !== slot.sourceSessionId)
      reject("نتيجة سهرة غير معتمدة", 409, "INVALID_NIGHT_RECEIPT");
    const receipt = slot.resultReceipt as { schemaVersion?: number; game?: string; sourceSessionId?: string;
      digest?: string; placements?: NightPlacement[] };
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) ||
      receipt.schemaVersion !== 1 || receipt.game !== slot.gameSlug ||
      receipt.sourceSessionId !== slot.sourceSessionId || receipt.digest !== slot.resultDigest ||
      JSON.stringify(receipt.placements) !== JSON.stringify(result.placements))
      reject("إيصال اللعبة لا يطابق نتيجة السهرة", 409, "INVALID_NIGHT_RECEIPT");
    try {
      if (i) replay = advanceNight(replay);
      replay = acceptVerifiedResult(replay, { game: result.game, sourceSessionId: result.sourceSessionId,
        placements: receipt.placements! });
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
