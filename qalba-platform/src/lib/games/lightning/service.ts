import { readDeadlineView, ViewDeadlineDue } from '@/lib/realtime/read-view';
import { createHash, randomInt, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { newToken, tokenHash } from "@/lib/auth/crypto";
import { consumeGameCredit } from "@/lib/billing/credits";
import { TEAM_COLORS } from "@/lib/design/team-colors";
import { recordEvent, type EventName } from "@/lib/analytics/events";
import { DISPLAY_ACTIVE_LINK_LIMIT, DISPLAY_LINKS_PER_WINDOW, DISPLAY_LINK_WINDOW_MS, DISPLAY_TOKEN_TTL_MS, displayWindowEndsAt, displayAccessValid } from "@/lib/games/category-board/display-policy";
import { BUZZER_ACTIVE_LINKS_PER_TEAM, BUZZER_TOKEN_TTL_MS, BUZZER_LINK_WINDOW_MS, BUZZER_LINKS_PER_WINDOW, buzzerAccessValid } from "./access-policy";
import { lobby, fresh, transition, buzz, timeout, expired, assertPhase, winners, isRevealed, validateQuestion, recentPool, bounded, LightningError, QUESTION_COUNT, type Question, type State, type HostAction } from "./module";
export type Actor = { kind: "HOST"; id: string } | { kind: "DISPLAY"; token: string } | { kind: "BUZZER"; token: string };
const include = { gameType: { select: { slug: true } }, teams: { orderBy: { position: "asc" as const } } };
type Session = Prisma.GameSessionGetPayload<{ include: typeof include }>;
const json = (v: unknown) => v as Prisma.InputJsonValue;
const lock = (tx: Prisma.TransactionClient, id: string) => tx.$queryRawUnsafe('SELECT "id" FROM "GameSession" WHERE "id"=$1 FOR UPDATE', id);
function stateOf(session: Pick<Session, "gameType" | "state"> | null) {
  if (!session || session.gameType.slug !== "lightning-quiz") throw new LightningError("المباراة غير موجودة", 404);
  const s = session.state as unknown as State;
  if (s.module !== "LIGHTNING_QUIZ" || s.schemaVersion !== 1) throw new LightningError("الجلسة ليست البرق", 404);
  return s;
}
async function authorize(tx: Prisma.TransactionClient, session: Pick<Session, "id" | "hostId" | "endedAt">, s: State, actor: Actor, now: number) {
  if (actor.kind === "HOST") { if (session.hostId !== actor.id) throw new LightningError("غير مصرح بإدارة المباراة", 403); return null; }
  if (!/^[A-Za-z0-9_-]{43}$/.test(actor.token)) throw new LightningError("رابط غير صالح", 403, `${actor.kind}_ACCESS_DENIED`);
  if (actor.kind === "DISPLAY") {
    const a = await tx.displayAccess.findUnique({ where: { tokenHash: tokenHash(actor.token) } });
    if (!a || a.sessionId !== session.id || !displayAccessValid(a, session, new Date(now))) throw new LightningError("انتهى وصول العرض", 403, "DISPLAY_ACCESS_DENIED");
    return null;
  }
  const a = await tx.lightningBuzzerAccess.findUnique({ where: { tokenHash: tokenHash(actor.token) } });
  const index = a ? s.teamIds.indexOf(a.teamId) : -1;
  if (!a || !buzzerAccessValid(a, session, s, now) || a.permission !== (index === 0 ? "TEAM_A_BUZZ" : "TEAM_B_BUZZ")) throw new LightningError("انتهى وصول جرس الفريق", 403, "BUZZER_ACCESS_DENIED");
  return a;
}
// Check access before Next's root loading boundary starts streaming a 200 response.
// Rendering and every API/SSE operation still authorize independently under the row lock.
// This preflight reads no question snapshot and never resolves timers or changes state.
export async function assertLightningPageAccess(id: string, actor: Extract<Actor, { kind: "BUZZER" | "DISPLAY" }>) {
  await db().$transaction(async tx => {
    const session = await tx.gameSession.findUnique({ where: { id }, select: { id: true, hostId: true, endedAt: true, state: true, gameType: { select: { slug: true } } } });
    const s = stateOf(session);
    await authorize(tx, session!, s, actor, Date.now());
  });
}
export async function createLightningSession(hostId: string, names: [string, string]) {
  const clean = names.map(n => bounded(n, 60));
  if (clean.some(n => n.length < 2) || clean[0] === clean[1]) throw new LightningError("اختر اسمين مختلفين", 400);
  const game = await db().gameType.findUnique({ where: { slug: "lightning-quiz" } });
  if (!game?.enabled) throw new LightningError("اللعبة غير متاحة", 404);
  const id = await db().$transaction(async tx => {
    const session = await tx.gameSession.create({ data: { hostId, gameTypeId: game.id, state: json(lobby()), config: { questions: QUESTION_COUNT, answerMs: 8000, stealMs: 5000, correctPoints: 2, stealPoints: 1, rematchCredit: "FREE_IN_SAME_SESSION", fairness: "SERVER_SERIALIZATION" } } });
    await tx.team.createMany({ data: clean.map((name, position) => ({ sessionId: session.id, name, position, color: TEAM_COLORS[position] })) });
    await recordEvent(tx, "GAME_CREATED", hostId, { sessionId: session.id, gameSlug: "lightning-quiz" }); return session.id;
  });
  return getLightningView(id, { kind: "HOST", id: hostId });
}
export function publicProjection(s: State, q: Question | null) {
  const phase = s.phase === "PAUSED" ? s.pausedPhase! : s.phase;
  const visible = q && !["LOBBY", "READY", "ABANDONED"].includes(phase);
  return { phase: s.phase, pausedPhase: s.pausedPhase, matchNumber: s.matchNumber, questionNumber: s.questionIndex + 1, questionCount: s.questionCount, buzzOpenedAt: s.buzzOpenedAt === null ? null : new Date(s.buzzOpenedAt).toISOString(), buzzWinnerTeamId: s.buzzWinnerIndex === null ? null : s.teamIds[s.buzzWinnerIndex], activeTeamId: s.activeIndex === null ? null : s.teamIds[s.activeIndex], deadlineAt: s.deadlineAt === null ? null : new Date(s.deadlineAt).toISOString(), remainingMs: s.remainingMs, lastEvent: [...s.lastEvent], question: visible ? { text: q.question, category: q.category, difficulty: q.difficulty } : null, revealedAnswer: q && isRevealed(s) ? { answer: q.answer, explanation: q.explanation } : null, result: isRevealed(s) ? { ...s.results.at(-1)! } : null, results: s.results.map(r => ({ ...r })), winnerIds: ["FINAL_RESULTS", "COMPLETED"].includes(s.phase) ? winners(s) : [] };
}
export function hostProjection(s: State, q: Question | null) {
  const result = publicProjection(s, q);
  return { ...result, privateAnswer: result.question && q ? { answer: q.answer, alternativeAnswers: [...q.alternativeAnswers], explanation: q.explanation } : null, canUndo: ["QUESTION_READY", "BUZZ_OPEN", "TEAM_ANSWERING", "STEAL"].includes(s.phase) && s.history.length > 0, canVoid: s.phase === "QUESTION_RESULTS" && Boolean(s.results.at(-1)?.points) && !s.results.at(-1)?.voided };
}
export function buzzerProjection(s: State, teamId: string) {
  return { phase: s.phase, pausedPhase: s.pausedPhase, matchNumber: s.matchNumber, questionNumber: s.questionIndex + 1, questionCount: s.questionCount, teamId, buzzWinnerTeamId: s.buzzWinnerIndex === null ? null : s.teamIds[s.buzzWinnerIndex], activeTeamId: s.activeIndex === null ? null : s.teamIds[s.activeIndex], deadlineAt: s.deadlineAt === null ? null : new Date(s.deadlineAt).toISOString(), remainingMs: s.remainingMs, canBuzz: s.phase === "BUZZ_OPEN", lastEvent: [...s.lastEvent] };
}
const eventNames = new Set(["LIGHTNING_GAME_STARTED", "LIGHTNING_QUESTION_READY", "LIGHTNING_BUZZ_OPENED", "LIGHTNING_BUZZ_LOCKED", "LIGHTNING_ANSWER_TIMER_STARTED", "LIGHTNING_ANSWER_CORRECT", "LIGHTNING_ANSWER_WRONG", "LIGHTNING_STEAL_STARTED", "LIGHTNING_STEAL_CORRECT", "LIGHTNING_STEAL_WRONG", "LIGHTNING_QUESTION_COMPLETED", "LIGHTNING_GAME_PAUSED", "LIGHTNING_GAME_RESUMED", "LIGHTNING_GAME_COMPLETED", "LIGHTNING_UNDO_AUDITED", "LIGHTNING_SCORE_VOIDED"]);
async function currentUse(tx: Prisma.TransactionClient, s: State) { return s.useIds[s.questionIndex] ? tx.lightningQuestionUse.findUnique({ where: { id: s.useIds[s.questionIndex] } }) : null; }
async function persist(tx: Prisma.TransactionClient, session: Session, old: State, next: State, key: string, hash: string | null, type: string, now: number) {
  const use = await currentUse(tx, next);
  for (const [i, team] of session.teams.entries()) {
    const delta = next.scores[i] - old.scores[i];
    if (delta) {
      await tx.team.update({ where: { id: team.id }, data: { score: next.scores[i] } });
      if (!["START", "REMATCH"].includes(type)) await tx.scoreEvent.create({ data: { sessionId: session.id, teamId: team.id, roundId: use!.gameRoundId, delta, reason: `LIGHTNING_${type}_M${next.matchNumber}_Q${next.questionIndex + 1}`, commandKey: `${session.id}:${key}:${i}` } });
    }
  }
  if (next.phase === "QUESTION_READY" && old.phase !== "QUESTION_READY" && use) await tx.lightningQuestionUse.update({ where: { id: use.id }, data: { openedAt: new Date(now) } });
  if (next.results.length > old.results.length && use) {
    await tx.lightningQuestionUse.update({ where: { id: use.id }, data: { endedAt: new Date(now) } });
    await tx.gameRound.update({ where: { id: use.gameRoundId }, data: { endedAt: new Date(now) } });
  }
  await tx.gameCommand.create({ data: { sessionId: session.id, key, type, payloadHash: hash, stateVersion: session.stateVersion + 1 } });
  const change = await tx.gameSession.updateMany({ where: { id: session.id, stateVersion: session.stateVersion }, data: { state: json(next), stateVersion: { increment: 1 }, currentRoundNumber: next.questionIndex + 1, status: next.phase === "LOBBY" ? "LOBBY" : next.phase === "READY" ? "READY" : next.phase === "PAUSED" ? "PAUSED" : next.phase === "COMPLETED" ? "COMPLETED" : next.phase === "ABANDONED" ? "ABANDONED" : "IN_PROGRESS", ...(type === "START" ? { startedAt: new Date(now), creditConsumedAt: new Date(now) } : {}), ...(["COMPLETE", "ABANDON"].includes(type) ? { endedAt: new Date(now) } : {}), ...(type === "REMATCH" ? { endedAt: null } : {}) } });
  if (change.count !== 1) throw new LightningError("تغيرت المباراة", 409, "STALE_GAME_STATE");
  for (const event of next.lastEvent) if (eventNames.has(event)) await recordEvent(tx, event as EventName, session.hostId, { sessionId: session.id, gameSlug: "lightning-quiz" });
}
async function timeoutLocked(tx: Prisma.TransactionClient, session: Session, s: State, now: number) { const next = timeout(s, now); await persist(tx, session, s, next, `timer:${s.matchNumber}:${s.questionIndex}:${session.stateVersion}`, null, "TIMEOUT", now); return next; }
export async function getLightningView(id: string, actor: Actor): Promise<LightningView> {
  return readDeadlineView(id, lock, async (tx, resolveDue) => {
    let session = await tx.gameSession.findUnique({ where: { id }, include }); let s = stateOf(session);
    const access = await authorize(tx, session!, s, actor, Date.now());
    if (expired(s, Date.now())) { if (!resolveDue) throw new ViewDeadlineDue(); s = await timeoutLocked(tx, session!, s, Date.now()); session = await tx.gameSession.findUnique({ where: { id }, include }); }
    const base = { id, version: session!.stateVersion, serverNow: new Date().toISOString(), teams: session!.teams.map((t, i) => ({ id: t.id, name: t.name, position: t.position, color: t.color, score: s.scores[i] })) };
    if (actor.kind === "BUZZER") return { ...base, ...buzzerProjection(s, access!.teamId) };
    const use = await currentUse(tx, s); const q = use?.snapshot as unknown as Question | null;
    return { ...base, ...(actor.kind === "HOST" ? hostProjection(s, q) : publicProjection(s, q)) };
  });
}
export type LightningView = { id: string; version: number; serverNow: string; teams: { id: string; name: string; position: number; color: string; score: number }[] } & Omit<ReturnType<typeof buzzerProjection>, "teamId" | "canBuzz"> & Partial<Pick<ReturnType<typeof buzzerProjection>, "teamId" | "canBuzz">> & Partial<Omit<ReturnType<typeof hostProjection>, keyof ReturnType<typeof buzzerProjection>>>;
async function select(tx: Prisma.TransactionClient, session: Session, s: State) {
  const [bank, recent] = await Promise.all([tx.lightningQuestion.findMany({ where: { status: "PUBLISHED", locale: "ar-SA", category: { active: true } }, include: { category: { select: { title: true } } }, orderBy: { id: "asc" }, take: 3000 }), tx.lightningQuestionUse.findMany({ where: { session: { hostId: session.hostId } }, orderBy: { selectedAt: "desc" }, take: 100, select: { questionId: true } })]);
  const valid = bank.filter(q => { try { return validateQuestion({ ...q, category: q.category.title }); } catch { return false; } });
  const chosen = recentPool(valid, recent.map(r => r.questionId), randomInt).slice(0, QUESTION_COUNT);
  if (chosen.length !== QUESTION_COUNT) throw new LightningError("يلزم ١٥ سؤالًا منشورًا صالحًا", 409, "CONTENT_TOO_SMALL");
  await tx.$queryRawUnsafe('SELECT "id" FROM "Category" WHERE "id"=ANY($1::text[]) ORDER BY "id" FOR SHARE', [...new Set(chosen.map(q => q.categoryId))]);
  await tx.$queryRawUnsafe('SELECT "id" FROM "LightningQuestion" WHERE "id"=ANY($1::text[]) ORDER BY "id" FOR SHARE', chosen.map(q => q.id));
  const latest = await tx.lightningQuestion.findMany({ where: { id: { in: chosen.map(q => q.id) }, status: "PUBLISHED", category: { active: true } }, include: { category: { select: { title: true } } } });
  const ids: string[] = [];
  for (const [i, q] of chosen.entries()) {
    const current = latest.find(v => v.id === q.id); if (!current) throw new LightningError("تغير المحتوى؛ أعد المحاولة", 409);
    const snapshot: Question = { question: current.question, answer: current.answer, alternativeAnswers: [...current.alternativeAnswers], explanation: current.explanation, category: current.category.title, difficulty: current.difficulty }; validateQuestion(snapshot);
    const gameRound = await tx.gameRound.create({ data: { sessionId: session.id, number: s.matchNumber * QUESTION_COUNT + i + 1 } }), id = randomUUID(); ids.push(id);
    await tx.lightningQuestionUse.create({ data: { id, sessionId: session.id, questionId: q.id, matchNumber: s.matchNumber + 1, questionIndex: i, gameRoundId: gameRound.id, snapshot: json(snapshot) } });
  }
  return ids;
}
export async function applyLightningCommand(id: string, hostId: string, key: string, expectedVersion: number, action: HostAction) {
  const hash = createHash("sha256").update(JSON.stringify({ hostId, action })).digest("hex");
  const outcome = await db().$transaction(async tx => {
    await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session);
    await authorize(tx, session!, s, { kind: "HOST", id: hostId }, Date.now());
    const prior = await tx.gameCommand.findUnique({ where: { sessionId_key: { sessionId: id, key } } });
    if (prior) { if (prior.payloadHash !== hash) throw new LightningError("معرف الأمر مستخدم لإجراء مختلف", 409, "COMMAND_KEY_REUSED"); return "DUPLICATE"; }
    const now = Date.now(); if (expired(s, now)) { await timeoutLocked(tx, session!, s, now); return "EXPIRED"; }
    if (session!.stateVersion !== expectedVersion) throw new LightningError("تغيرت المباراة؛ حدّث الحالة", 409, "STALE_GAME_STATE");
    let next: State;
    if (action.type === "START" || action.type === "REMATCH") {
      assertPhase(s, action.type === "START" ? "LOBBY" : "COMPLETED");
      if (session!.teams.length !== 2 || session!.teams.some((t, i) => t.position !== i)) throw new LightningError("ترتيب الفريقين غير صالح", 400);
      next = fresh(s, session!.teams.map(t => t.id), await select(tx, session!, s));
      if (action.type === "START") await consumeGameCredit(tx, hostId, id, Boolean(session!.creditConsumedAt));
      await tx.lightningBuzzerAccess.updateMany({ where: { sessionId: id, revokedAt: null }, data: { revokedAt: new Date(now) } });
    } else next = transition(s, action, now);
    await persist(tx, session!, s, next, key, hash, action.type, now); return "ACCEPTED";
  }, { timeout: 20000 });
  if (outcome === "EXPIRED") throw new LightningError("انتهت المهلة؛ حُسمت المرحلة مرة واحدة", 409, "TIMER_EXPIRED");
  return { session: await getLightningView(id, { kind: "HOST", id: hostId }), duplicate: outcome === "DUPLICATE" };
}
export async function applyBuzz(id: string, token: string, key: string, expectedVersion: number) {
  const outcome = await db().$transaction(async tx => {
    await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session), now = Date.now();
    const access = (await authorize(tx, session!, s, { kind: "BUZZER", token }, now))!;
    const hash = createHash("sha256").update(JSON.stringify({ teamId: access.teamId, matchNumber: s.matchNumber, action: "BUZZ" })).digest("hex");
    const prior = await tx.gameCommand.findUnique({ where: { sessionId_key: { sessionId: id, key } } });
    if (prior) { if (prior.payloadHash !== hash) throw new LightningError("معرف الأمر مستخدم لإجراء مختلف", 409, "COMMAND_KEY_REUSED"); return "DUPLICATE"; }
    // Phase/lock takes precedence over stale version, so a losing valid buzz gets the promised error.
    if (s.buzzWinnerIndex !== null) throw new LightningError("سبقكم الفريق الآخر", 409, "BUZZ_ALREADY_LOCKED");
    assertPhase(s, "BUZZ_OPEN");
    if (session!.stateVersion !== expectedVersion) throw new LightningError("تغيرت المباراة؛ حدّث الجرس", 409, "STALE_GAME_STATE");
    const next = buzz(s, s.teamIds.indexOf(access.teamId), now);
    await persist(tx, session!, s, next, key, hash, "BUZZ", now); return "ACCEPTED";
  }, { timeout: 20000 });
  return { session: await getLightningView(id, { kind: "BUZZER", token }), duplicate: outcome === "DUPLICATE" };
}
export async function createLightningBuzzerAccess(hostId: string, id: string, teamId: string) {
  const token = newToken(); const access = await db().$transaction(async tx => {
    await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session), now = Date.now();
    await authorize(tx, session!, s, { kind: "HOST", id: hostId }, now);
    if (s.matchNumber < 1 || ["FINAL_RESULTS", "COMPLETED", "ABANDONED"].includes(s.phase)) throw new LightningError("أنشئ الجرس بعد بدء المباراة وأثناء اللعب", 409, "INVALID_PHASE");
    const index = s.teamIds.indexOf(teamId); if (index < 0) throw new LightningError("الفريق لا ينتمي إلى المباراة", 400);
    await tx.lightningBuzzerAccess.updateMany({ where: { sessionId: id, teamId, revokedAt: null, expiresAt: { lte: new Date(now) } }, data: { revokedAt: new Date(now) } });
    const [active, recent] = await Promise.all([tx.lightningBuzzerAccess.count({ where: { sessionId: id, teamId, revokedAt: null, expiresAt: { gt: new Date(now) } } }), tx.lightningBuzzerAccess.count({ where: { sessionId: id, teamId, createdAt: { gte: new Date(now - BUZZER_LINK_WINDOW_MS) } } })]);
    if (active >= BUZZER_ACTIVE_LINKS_PER_TEAM || recent >= BUZZER_LINKS_PER_WINDOW) throw new LightningError("وصلت إلى حد روابط جرس الفريق؛ ألغِ الرابط الحالي أولًا", 429, "BUZZER_LINK_LIMIT");
    return tx.lightningBuzzerAccess.create({ data: { sessionId: id, teamId, matchNumber: s.matchNumber, permission: index === 0 ? "TEAM_A_BUZZ" : "TEAM_B_BUZZ", tokenHash: tokenHash(token), expiresAt: new Date(now + BUZZER_TOKEN_TTL_MS) } });
  }); return { token, expiresAt: access.expiresAt };
}
export async function revokeLightningBuzzerAccess(hostId: string, id: string, teamId: string) { await db().$transaction(async tx => { await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session); await authorize(tx, session!, s, { kind: "HOST", id: hostId }, Date.now()); if (!session!.teams.some(t => t.id === teamId)) throw new LightningError("الفريق لا ينتمي إلى المباراة", 400); await tx.lightningBuzzerAccess.updateMany({ where: { sessionId: id, teamId, revokedAt: null }, data: { revokedAt: new Date() } }); }); }
export async function createLightningDisplayAccess(hostId: string, id: string) {
  const token = newToken(); const expiresAt = await db().$transaction(async tx => {
    await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session), now = new Date(); await authorize(tx, session!, s, { kind: "HOST", id: hostId }, now.getTime());
    const end = displayWindowEndsAt(session!.endedAt, now); if (session!.endedAt && !end) throw new LightningError("انتهت فترة العرض", 410);
    const [active, recent] = await Promise.all([tx.displayAccess.count({ where: { sessionId: id, revokedAt: null, expiresAt: { gt: now } } }), tx.displayAccess.count({ where: { sessionId: id, createdAt: { gte: new Date(now.getTime() - DISPLAY_LINK_WINDOW_MS) } } })]);
    if (active >= DISPLAY_ACTIVE_LINK_LIMIT || recent >= DISPLAY_LINKS_PER_WINDOW) throw new LightningError("وصلت إلى حد روابط العرض", 429);
    const expiry = new Date(Math.min(now.getTime() + DISPLAY_TOKEN_TTL_MS, end?.getTime() ?? Infinity)); await tx.displayAccess.create({ data: { sessionId: id, tokenHash: tokenHash(token), expiresAt: expiry } }); return expiry;
  }); return { token, expiresAt };
}
export async function revokeLightningDisplayAccess(hostId: string, id: string) { await db().$transaction(async tx => { await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session); await authorize(tx, session!, s, { kind: "HOST", id: hostId }, Date.now()); await tx.displayAccess.updateMany({ where: { sessionId: id, revokedAt: null }, data: { revokedAt: new Date() } }); }); }
