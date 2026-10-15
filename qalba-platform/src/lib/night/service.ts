import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { createRankedSessionInTransaction } from "@/lib/games/ranked/service";
import { createOrderingSessionInTransaction } from "@/lib/games/ordering/service";
import { createSurveySessionInTransaction } from "@/lib/games/survey-battle/service";
import { acceptVerifiedResult, advanceNight, endNight, nightLeaderboard, prepareNight, startNight, NightRuleError, type NightState } from "./core";
import { isNightGame, nightEnabled, nightGameTitle, type NightGameSlug } from "./catalog";
import { NightVerificationError, verifyNightOutcome } from "./adapters";
import type { NightCommandInput, NightCreateInput, NightResultReceipt, NightTeamMapping, NightView } from "./types";

export class NightServiceError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}
function fail(message: string, status: number, code: string): never { throw new NightServiceError(message, status, code); }
function enabled() { if (!nightEnabled()) fail("ليلة قدّام غير متاحة حاليًا", 404, "FEATURE_DISABLED"); }
function strictKeys(input: unknown, expected: readonly string[]) {
  if (typeof input !== "object" || input === null || Array.isArray(input) || Object.keys(input).length !== expected.length || Object.keys(input).some(k => !expected.includes(k))) fail("حقول الطلب غير صالحة", 400, "INVALID_INPUT");
}
function key(value: unknown) { if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail("معرّف الطلب غير صالح", 400, "INVALID_INPUT"); }
function id(value: string) { if (!/^[A-Za-z0-9_-]{1,100}$/.test(value)) fail("الليلة غير موجودة", 404, "NOT_FOUND"); }
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const json = (value: unknown) => value as Prisma.InputJsonValue;
const include = { games: { orderBy: { position: "asc" as const } } };
type Session = Prisma.NightSessionGetPayload<{ include: typeof include }>;
type Slot = Session["games"][number];
const sourceInclude = { gameType: { select: { slug: true } }, teams: { orderBy: { position: "asc" as const } }, commands: { orderBy: { stateVersion: "asc" as const }, select: { type: true, stateVersion: true } }, rankedUses: { orderBy: { roundIndex: "asc" as const }, select: { id: true, matchNumber: true, roundIndex: true, gameRound: { select: { endedAt: true } } } }, orderingUses: { orderBy: { roundIndex: "asc" as const }, select: { id: true, matchNumber: true, roundIndex: true, endedAt: true } }, surveyQuestionUses: { orderBy: { roundNumber: "asc" as const }, select: { id: true, matchNumber: true, roundNumber: true } } };
function own(session: Session | null, ownerId: string): Session {
  if (!session || session.ownerId !== ownerId) fail("الليلة غير موجودة", 404, "NOT_FOUND");
  return session;
}
function stateOf(session: Session): NightState {
  const s = session.state as unknown as NightState;
  if (!s || s.schemaVersion !== 1 || s.nightId !== session.id || s.version !== session.stateVersion || s.phase !== session.phase || !Array.isArray(s.teams) || s.teams.length !== 2 || !Array.isArray(s.games) || s.games.length !== 3 || !s.games.every(isNightGame) || new Set(s.games).size !== 3 || !Number.isSafeInteger(s.currentIndex) || s.currentIndex < 0 || s.currentIndex >= 3 || !Array.isArray(s.results) || session.games.length !== 3 || session.games.some((slot, i) => slot.position !== i || slot.gameSlug !== s.games[i])) fail("تعذر التحقق من سلامة الليلة", 409, "INVALID_NIGHT_STATE");
  return s;
}
function hostHref(game: string, sourceId: string | null) {
  if (!sourceId) return null;
  const prefix = { "top-list": "/ranked", "ordering-challenge": "/ordering", "survey-show": "/survey-show" }[game];
  return prefix ? `${prefix}/host/${encodeURIComponent(sourceId)}` : null;
}
async function verified(tx: Prisma.TransactionClient, session: Session, slot: Slot, lockSource: boolean): Promise<NightResultReceipt> {
  if (!slot.sourceSessionId || !isNightGame(slot.gameSlug)) fail("ابدأ اللعبة الحالية أولًا", 409, "SOURCE_NOT_VERIFIED");
  if (lockSource) await tx.$queryRawUnsafe('SELECT "id" FROM "GameSession" WHERE "id"=$1 FOR UPDATE', slot.sourceSessionId);
  const source = await tx.gameSession.findUnique({ where: { id: slot.sourceSessionId }, include: sourceInclude });
  if (!source) fail("تعذر التحقق من نتيجة اللعبة", 409, "SOURCE_NOT_VERIFIED");
  const mapping = slot.teamMapping as unknown as NightTeamMapping[];
  const state = stateOf(session);
  if (!Array.isArray(mapping) || mapping.some((m, i) => m.nightTeamId !== state.teams[i]?.id || m.name !== state.teams[i]?.name || m.position !== i)) fail("هوية الفرق لا تطابق الربط المحفوظ", 409, "SOURCE_NOT_VERIFIED");
  try { return verifyNightOutcome(session.ownerId, slot.gameSlug, mapping, source); }
  catch (error) { if (error instanceof NightVerificationError) fail(error.message, 409, error.code); throw error; }
}
async function view(tx: Prisma.TransactionClient, session: Session): Promise<NightView> {
  const state = stateOf(session), leaderboard = nightLeaderboard(state), current = session.games[state.currentIndex];
  const sources = await tx.gameSession.findMany({ where: { id: { in: session.games.flatMap(slot => slot.sourceSessionId ? [slot.sourceSessionId] : []) } }, select: { id: true, status: true } });
  const games = session.games.map(slot => ({ game: slot.gameSlug as NightGameSlug, title: nightGameTitle(slot.gameSlug), position: slot.position, hostHref: hostHref(slot.gameSlug, slot.sourceSessionId), sourceStatus: sources.find(s => s.id === slot.sourceSessionId)?.status ?? null, imported: slot.resultReceipt !== null }));
  let importReady = false, blockedReason: string | null = null;
  if (state.phase === "playing" && current?.sourceSessionId && !current.resultReceipt) {
    const sourceStatus = games[state.currentIndex].sourceStatus;
    if (sourceStatus === "COMPLETED") {
      try { await verified(tx, session, current, false); importReady = true; }
      catch (error) { if (error instanceof NightServiceError) blockedReason = error.message; else throw error; }
    } else if (sourceStatus === "ABANDONED") blockedReason = "أُلغيت المباراة؛ لا تُحتسب لها نتيجة. يمكنك إنهاء الليلة دون بطل.";
  }
  return { id: session.id, phase: state.phase, version: state.version, teams: state.teams.map(t => ({ ...t })), games,
    currentIndex: state.currentIndex,
    current: state.phase === "preparing" ? null : { index: state.currentIndex, game: current.gameSlug as NightGameSlug, title: nightGameTitle(current.gameSlug), hostHref: hostHref(current.gameSlug, current.sourceSessionId), sourceStatus: games[state.currentIndex].sourceStatus },
    importReady, blockedReason, canNext: state.phase === "playing" && current.resultReceipt !== null && state.currentIndex + 1 < state.games.length,
    results: state.results, totals: state.totals, ranking: leaderboard.ranking, winnerIds: leaderboard.winnerIds };
}
export async function createNightSession(ownerId: string, input: NightCreateInput): Promise<NightView> {
  enabled(); strictKeys(input, ["key", "games", "teams"]); key(input?.key);
  if (!Array.isArray(input.games) || input.games.length !== 3 || !input.games.every(isNightGame) || new Set(input.games).size !== 3 || !Array.isArray(input.teams) || input.teams.length !== 2) fail("اختر الألعاب الثلاث وفريقين مختلفين", 400, "INVALID_INPUT");
  let state: NightState;
  try { state = prepareNight({ nightId: randomUUID(), games: input.games, teams: input.teams.map(name => ({ id: randomUUID(), name })) }); }
  catch (error) { if (error instanceof NightRuleError) fail("اختر اسمين مختلفين للفريقين، من حرفين إلى ٦٠ حرفًا", 400, error.code); throw error; }
  if (state.teams.some(t => t.name.length < 2)) fail("اسم الفريق قصير جدًا", 400, "INVALID_TEAM");
  const createHash = hash({ games: state.games, teams: state.teams.map(t => t.name) });
  return db().$transaction(async tx => {
    // Serialize retries before checking uniqueness; no orphan child can be created.
    await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1, 0))", `night-create:${ownerId}:${input.key}`);
    const prior = await tx.nightSession.findUnique({ where: { ownerId_createKey: { ownerId, createKey: input.key } }, include });
    if (prior) { if (prior.createHash !== createHash) fail("معرّف الطلب مستخدم لاختيارات أخرى", 409, "COMMAND_KEY_REUSED"); return view(tx, prior); }
    const unavailable = await tx.gameType.count({ where: { slug: { in: input.games }, enabled: true } });
    if (unavailable !== 3) fail("إحدى الألعاب المختارة غير متاحة", 409, "GAME_UNAVAILABLE");
    const created = await tx.nightSession.create({ data: { id: state.nightId, ownerId, createKey: input.key, createHash, phase: state.phase, state: json(state), games: { create: state.games.map((gameSlug, position) => ({ gameSlug, position })) } }, include });
    return view(tx, created);
  }, { timeout: 20_000 });
}
export async function getNightView(ownerId: string, nightId: string): Promise<NightView> {
  enabled(); id(nightId);
  return db().$transaction(async tx => view(tx, own(await tx.nightSession.findUnique({ where: { id: nightId }, include }), ownerId)));
}
async function createChild(tx: Prisma.TransactionClient, session: Session, state: NightState) {
  const slot = session.games[state.currentIndex];
  if (slot.sourceSessionId) fail("اللعبة الحالية منشأة بالفعل", 409, "INVALID_PHASE");
  const names: [string, string] = [state.teams[0].name, state.teams[1].name];
  const creators = { "top-list": createRankedSessionInTransaction, "ordering-challenge": createOrderingSessionInTransaction, "survey-show": createSurveySessionInTransaction };
  const sourceSessionId = await creators[slot.gameSlug as NightGameSlug](tx, session.ownerId, names);
  const teams = await tx.team.findMany({ where: { sessionId: sourceSessionId }, orderBy: { position: "asc" } });
  if (teams.length !== 2 || teams.some((t, i) => t.position !== i || t.name !== state.teams[i].name)) fail("تعذر ربط الفرق باللعبة", 409, "INVALID_TEAM_MAPPING");
  const teamMapping = teams.map((team, position) => ({ nightTeamId: state.teams[position].id, sourceTeamId: team.id, name: team.name, position }));
  await tx.nightGame.update({ where: { id: slot.id }, data: { sourceSessionId, teamMapping: json(teamMapping) } });
}
export async function applyNightCommand(ownerId: string, nightId: string, input: NightCommandInput): Promise<NightView> {
  enabled(); id(nightId); strictKeys(input, ["key", "expectedVersion", "op"]); key(input?.key);
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || !["START", "IMPORT", "NEXT", "END"].includes(input.op)) fail("الأمر غير صالح", 400, "INVALID_INPUT");
  const payloadHash = hash({ ownerId, op: input.op, expectedVersion: input.expectedVersion });
  return db().$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "NightSession" WHERE "id"=$1 FOR UPDATE', nightId);
    const session = own(await tx.nightSession.findUnique({ where: { id: nightId }, include }), ownerId), state = stateOf(session);
    const prior = await tx.nightCommand.findUnique({ where: { nightId_key: { nightId, key: input.key } } });
    if (prior) {
      if (prior.payloadHash !== payloadHash) fail("معرّف الطلب مستخدم لأمر مختلف", 409, "COMMAND_KEY_REUSED");
      if (input.op === "IMPORT") {
        for (const slot of session.games.filter(g => g.resultReceipt !== null)) {
          const receipt = await verified(tx, session, slot, true);
          if (receipt.digest !== slot.resultDigest) fail("تغيرت المباراة بعد اعتماد نتيجتها؛ النتيجة المحفوظة لن تُعدّل", 409, "CONFLICTING_REPLAY");
        }
      }
      return view(tx, session);
    }
    if (state.version !== input.expectedVersion) fail("تغيّرت الليلة؛ حدّث الحالة", 409, "STALE_NIGHT_STATE");
    let next: NightState;
    try {
      if (input.op === "START") { next = startNight(state); await createChild(tx, session, next); }
      else if (input.op === "NEXT") { next = advanceNight(state); await createChild(tx, session, next); }
      else if (input.op === "END") next = endNight(state);
      else {
        const slot = session.games[state.currentIndex];
        if (state.phase !== "playing" && !slot.resultReceipt) fail("لا يمكن اعتماد نتيجة في هذه المرحلة", 409, "INVALID_PHASE");
        const receipt = await verified(tx, session, slot, true);
        if (slot.resultReceipt) {
          if (slot.resultDigest !== receipt.digest) fail("لا يمكن إعادة كتابة نتيجة معتمدة", 409, "CONFLICTING_REPLAY");
          next = state;
        } else {
          if (state.results.length !== state.currentIndex) fail("ترتيب النتائج غير صالح", 409, "INVALID_PHASE");
          next = acceptVerifiedResult(state, { game: receipt.game, sourceSessionId: receipt.sourceSessionId, placements: receipt.placements });
          await tx.nightGame.update({ where: { id: slot.id }, data: { resultReceipt: json(receipt), resultDigest: receipt.digest, sourceVersion: receipt.sourceVersion, acceptedAt: new Date() } });
        }
      }
    } catch (error) { if (error instanceof NightRuleError) fail("الإجراء غير متاح في مرحلة الليلة الحالية", 409, error.code); throw error; }
    await tx.nightCommand.create({ data: { nightId, key: input.key, type: input.op, payloadHash, stateVersion: next.version } });
    if (next !== state) {
      const changed = await tx.nightSession.updateMany({ where: { id: nightId, stateVersion: state.version }, data: { state: json(next), phase: next.phase, stateVersion: next.version } });
      if (changed.count !== 1) fail("تغيّرت الليلة؛ حدّث الحالة", 409, "STALE_NIGHT_STATE");
    }
    return view(tx, own(await tx.nightSession.findUnique({ where: { id: nightId }, include }), ownerId));
  }, { timeout: 20_000 });
}
export async function findNightForSource(ownerId: string, game: NightGameSlug, sourceId: string): Promise<{ id: string } | null> {
  if (!nightEnabled()) return null;
  const slot = await db().nightGame.findFirst({ where: { sourceSessionId: sourceId, gameSlug: game, night: { ownerId } }, select: { nightId: true } });
  return slot ? { id: slot.nightId } : null;
}
