import { readDeadlineView, ViewDeadlineDue } from '@/lib/realtime/read-view';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { newToken, tokenHash } from '@/lib/auth/crypto';
import { consumeGameCredit } from '@/lib/billing/credits';
import { TEAM_COLORS } from '@/lib/design/team-colors';
import { recordEvent, type EventName } from '@/lib/analytics/events';
import { DISPLAY_ACTIVE_LINK_LIMIT, DISPLAY_LINKS_PER_WINDOW, DISPLAY_LINK_WINDOW_MS, DISPLAY_TOKEN_TTL_MS, displayWindowEndsAt, displayAccessValid } from '@/lib/games/category-board/display-policy';
import { CONTROLLER_ACTIVE_LINKS_PER_TEAM, CONTROLLER_TOKEN_TTL_MS, CONTROLLER_LINK_WINDOW_MS, CONTROLLER_LINKS_PER_WINDOW, controllerAccessValid } from './access-policy';
import { lobby, fresh, transition, reveal, expired, assertPhase, winners, isRevealed, validateQuestion, recentPool, shuffle, bounded, OrderingError, ROUND_COUNT, type Question, type State, type HostAction, type TeamAction } from './module';
export type Actor = { kind: 'HOST'; id: string } | { kind: 'DISPLAY'; token: string } | { kind: 'CONTROLLER'; token: string };
const include = { gameType: { select: { slug: true } }, teams: { orderBy: { position: 'asc' as const } } };
type Session = Prisma.GameSessionGetPayload<{ include: typeof include }>;
const json = (v: unknown) => v as Prisma.InputJsonValue;
const lock = (tx: Prisma.TransactionClient, id: string) => tx.$queryRawUnsafe('SELECT "id" FROM "GameSession" WHERE "id"=$1 FOR UPDATE', id);
function stateOf(session: Session | null) { if (!session || session.gameType.slug !== 'ordering-challenge') throw new OrderingError('المباراة غير موجودة', 404); const s = session.state as unknown as State; if (s.module !== 'ORDERING' || s.schemaVersion !== 1) throw new OrderingError('الجلسة ليست رتّبها', 404); return s; }
async function authorize(tx: Prisma.TransactionClient, session: Session, s: State, actor: Actor, now: number) {
 if (actor.kind === 'HOST') { if (session.hostId !== actor.id) throw new OrderingError('غير مصرح بإدارة المباراة', 403); return null; }
 if (!/^[A-Za-z0-9_-]{43}$/.test(actor.token)) throw new OrderingError('رابط غير صالح', 403, `${actor.kind}_ACCESS_DENIED`);
 if (actor.kind === 'DISPLAY') { const a = await tx.displayAccess.findUnique({ where: { tokenHash: tokenHash(actor.token) } }); if (!a || a.sessionId !== session.id || !displayAccessValid(a, session, new Date(now))) throw new OrderingError('انتهى وصول العرض', 403, 'DISPLAY_ACCESS_DENIED'); return null; }
 const a = await tx.orderingControllerAccess.findUnique({ where: { tokenHash: tokenHash(actor.token) } }); const index = a ? s.teamIds.indexOf(a.teamId) : -1;
 if (!a || !controllerAccessValid(a, session, s, now) || a.permission !== (index === 0 ? 'ORDER_TEAM_A' : 'ORDER_TEAM_B')) throw new OrderingError('انتهى وصول ترتيب الفريق', 403, 'CONTROLLER_ACCESS_DENIED'); return a;
}
export async function createOrderingSessionInTransaction(tx: Prisma.TransactionClient, hostId: string, names: [string, string]) {
 const clean = names.map(n => bounded(n, 60)); if (clean.some(n => n.length < 2) || clean[0] === clean[1]) throw new OrderingError('اختر اسمين مختلفين', 400);
 const game = await tx.gameType.findUnique({ where: { slug: 'ordering-challenge' } }); if (!game?.enabled) throw new OrderingError('اللعبة غير متاحة', 404);
 const session = await tx.gameSession.create({ data: { hostId, gameTypeId: game.id, state: json(lobby()), config: { rounds: ROUND_COUNT, orderMs: 45000, pointsPerExactPosition: 2, perfectBonus: 2, rematchCredit: 'FREE_IN_SAME_SESSION' } } }); await tx.team.createMany({ data: clean.map((name, position) => ({ sessionId: session.id, name, position, color: TEAM_COLORS[position] })) }); await recordEvent(tx, 'GAME_CREATED', hostId, { sessionId: session.id, gameSlug: 'ordering-challenge' }); return session.id;
}
export async function createOrderingSession(hostId: string, names: [string, string]) {
 const id = await db().$transaction(tx => createOrderingSessionInTransaction(tx, hostId, names)); return getOrderingView(id, { kind: 'HOST', id: hostId });
}
export function publicProjection(s: State, q: Question | null) {
 const phase = s.phase === 'PAUSED' ? s.pausedPhase : s.phase; const visible = q && !['LOBBY', 'READY', 'ROUND_INTRO', 'ABANDONED'].includes(phase!); const disclosed = q && isRevealed(s); const result = disclosed ? s.results.find(r => r.roundNumber === s.roundIndex + 1)! : null;
 return { phase: s.phase, pausedPhase: s.pausedPhase, matchNumber: s.matchNumber, roundNumber: s.roundIndex + 1, roundCount: s.roundCount, deadlineAt: s.deadlineAt === null ? null : new Date(s.deadlineAt).toISOString(), remainingMs: s.remainingMs, submitted: [...s.submitted], lastEvent: [...s.lastEvent], question: visible ? { title: q.title, instruction: q.instruction, category: q.category, items: q.presentation.map(id => { const i = q.items.find(i => i.id === id)!; return { id, label: i.label }; }) } : null, reveal: disclosed ? { correctOrder: [...q.items].sort((a, b) => a.correctPosition - b.correctPosition).map(i => ({ id: i.id, label: i.label, displayValue: i.displayValue })), teamOrders: result!.orders.map(order => order.map(id => ({ id, label: q.items.find(i => i.id === id)!.label }))), metrics: result!.metrics.map(m => ({ ...m })), winner: result!.winner, voided: result!.voided, reason: result!.reason, explanation: q.explanation, sourceLabel: q.sourceLabel, sourceUrl: q.sourceUrl, sourceDate: q.sourceDate } : null, results: s.results.map(r => ({ roundNumber: r.roundNumber, metrics: r.metrics.map(m => ({ ...m })), winner: r.winner, voided: r.voided })), winnerIds: ['FINAL_RESULTS', 'COMPLETED'].includes(s.phase) ? winners(s) : [] };
}
export function hostProjection(s: State, q: Question | null) { return { ...publicProjection(s, q), canReopen: s.phase === 'ORDERING' ? s.submitted.map(Boolean) : [false, false], canVoid: ['REVEAL', 'ROUND_RESULTS'].includes(s.phase) && Boolean(s.results.at(-1)) && !s.results.at(-1)?.voided }; }
export function controllerProjection(s: State, q: Question | null, teamId: string) { const index = s.teamIds.indexOf(teamId); if (index < 0) throw new OrderingError('الفريق غير مصرح', 403); return { ...publicProjection(s, q), teamId, privateOrder: ['ORDERING', 'PAUSED'].includes(s.phase) ? [...s.orders[index]] : null, revision: s.revisions[index], canOrder: s.phase === 'ORDERING' && !s.submitted[index] }; }
const eventNames = new Set(['ORDER_GAME_STARTED', 'ORDER_ROUND_STARTED', 'ORDER_TEAM_PROGRESS', 'ORDER_TEAM_SUBMITTED', 'ORDER_TIMER_EXPIRED', 'ORDER_REVEAL_STARTED', 'ORDER_ROUND_COMPLETED', 'ORDER_GAME_PAUSED', 'ORDER_GAME_RESUMED', 'ORDER_GAME_COMPLETED', 'ORDER_TEAM_REOPENED', 'ORDER_RESULT_VOIDED', 'ORDER_GAME_ENDED', 'ORDER_GAME_ABANDONED', 'ORDER_FINAL_RESULTS']);
async function currentUse(tx: Prisma.TransactionClient, s: State, index = s.roundIndex) { return s.useIds[index] ? tx.orderingQuestionUse.findUnique({ where: { id: s.useIds[index] } }) : null; }
async function persist(tx: Prisma.TransactionClient, session: Session, old: State, next: State, key: string, hash: string | null, type: string, now: number) {
 const use = await currentUse(tx, next); const addedResult = next.results.length > old.results.length;
 for (const [i, team] of session.teams.entries()) {
  const delta = next.scores[i] - old.scores[i]; if (delta) await tx.team.update({ where: { id: team.id }, data: { score: next.scores[i] } });
  // Include zero-point resolution receipts too: every team/round is auditable exactly once.
  if (addedResult || type === 'VOID_RESULT' && delta) await tx.scoreEvent.create({ data: { sessionId: session.id, teamId: team.id, roundId: use!.gameRoundId, delta, reason: `ORDER_${type}_M${next.matchNumber}_R${next.roundIndex + 1}`, commandKey: `${session.id}:${key}:${i}` } });
 }
 if (next.phase === 'ORDERING' && (old.phase !== 'ORDERING' && old.phase !== 'PAUSED' || old.roundIndex !== next.roundIndex) && use) await tx.orderingQuestionUse.update({ where: { id: use.id }, data: { openedAt: new Date(now) } });
 if (addedResult && use) { const r = next.results.at(-1)!; await tx.orderingQuestionUse.update({ where: { id: use.id }, data: { endedAt: new Date(now), scoreAudit: json({ metrics: r.metrics, winner: r.winner, reason: r.reason, voided: false }) } }); await tx.gameRound.update({ where: { id: use.gameRoundId }, data: { endedAt: new Date(now) } }); }
 if (type === 'VOID_RESULT' && use) await tx.orderingQuestionUse.update({ where: { id: use.id }, data: { scoreAudit: json({ metrics: next.results.at(-1)!.metrics, winner: 'TIE', voided: true }) } });
 await tx.gameCommand.create({ data: { sessionId: session.id, key, type, payloadHash: hash, stateVersion: session.stateVersion + 1 } });
 const change = await tx.gameSession.updateMany({ where: { id: session.id, stateVersion: session.stateVersion }, data: { state: json(next), stateVersion: { increment: 1 }, currentRoundNumber: next.roundIndex + 1, status: next.phase === 'LOBBY' ? 'LOBBY' : next.phase === 'READY' ? 'READY' : next.phase === 'PAUSED' ? 'PAUSED' : next.phase === 'COMPLETED' ? 'COMPLETED' : next.phase === 'ABANDONED' ? 'ABANDONED' : 'IN_PROGRESS', ...(type === 'START' ? { startedAt: new Date(now), creditConsumedAt: new Date(now) } : {}), ...(['COMPLETE', 'ABANDON'].includes(type) ? { endedAt: new Date(now) } : {}), ...(type === 'REMATCH' ? { endedAt: null } : {}) } }); if (change.count !== 1) throw new OrderingError('تغيرت المباراة', 409, 'STALE_GAME_STATE');
 for (const event of next.lastEvent) if (eventNames.has(event)) await recordEvent(tx, event as EventName, session.hostId, { sessionId: session.id, gameSlug: 'ordering-challenge' });
}
async function timeoutLocked(tx: Prisma.TransactionClient, session: Session, s: State, now: number) { const use = await currentUse(tx, s); const next = reveal(s, use!.snapshot as unknown as Question, 'TIMEOUT'); await persist(tx, session, s, next, `timer:${s.matchNumber}:${s.roundIndex}:${session.stateVersion}`, null, 'TIMEOUT', now); return next; }
export async function getOrderingView(id: string, actor: Actor): Promise<OrderingView> {
 return readDeadlineView(id, lock, async (tx, resolveDue) => { let session = await tx.gameSession.findUnique({ where: { id }, include }); let s = stateOf(session); const access = await authorize(tx, session!, s, actor, Date.now()); if (expired(s, Date.now())) { if (!resolveDue) throw new ViewDeadlineDue(); s = await timeoutLocked(tx, session!, s, Date.now()); session = await tx.gameSession.findUnique({ where: { id }, include }); } const use = await currentUse(tx, s), q = use?.snapshot as unknown as Question | null;
  return { id, version: session!.stateVersion, serverNow: new Date().toISOString(), teams: session!.teams.map((t, i) => ({ id: t.id, name: t.name, position: t.position, color: t.color, score: s.scores[i] })), ...(actor.kind === 'CONTROLLER' ? controllerProjection(s, q, access!.teamId) : actor.kind === 'HOST' ? hostProjection(s, q) : publicProjection(s, q)) };
 });
}
export type OrderingView = { id: string; version: number; serverNow: string; teams: { id: string; name: string; position: number; color: string; score: number }[] } & ReturnType<typeof publicProjection> & Partial<Pick<ReturnType<typeof controllerProjection>, 'teamId' | 'privateOrder' | 'revision' | 'canOrder'>> & Partial<Pick<ReturnType<typeof hostProjection>, 'canReopen' | 'canVoid'>>;
async function select(tx: Prisma.TransactionClient, session: Session, s: State) {
 const [bank, recent] = await Promise.all([tx.orderingQuestion.findMany({ where: { status: 'PUBLISHED', locale: 'ar-SA', category: { active: true } }, include: { category: { select: { title: true } }, items: true }, orderBy: { id: 'asc' }, take: 3000 }), tx.orderingQuestionUse.findMany({ where: { session: { hostId: session.hostId } }, orderBy: { selectedAt: 'desc' }, take: 100, select: { questionId: true } })]);
 const asQuestion = (q: typeof bank[number]): Question => ({ title:q.title,instruction:q.instruction,difficulty:q.difficulty,factual:q.factual,sourceLabel:q.sourceLabel,sourceUrl:q.sourceUrl,explanation:q.explanation, category: q.category.title, locale: 'ar-SA', orderingType: q.orderingType as Question['orderingType'], sourceDate: q.sourceDate?.toISOString().slice(0, 10) ?? null, items: q.items.map(i => ({ id: randomUUID(), label: i.label, correctPosition: i.correctPosition, acceptedAliases: [...i.acceptedAliases], displayValue: i.displayValue })), presentation: [] });
 const chosen = recentPool(bank.filter(q => { try { return validateQuestion(asQuestion(q)); } catch { return false; } }), recent.map(r => r.questionId), randomInt).slice(0, ROUND_COUNT); if (chosen.length !== ROUND_COUNT) throw new OrderingError('يلزم ٧ تحديات منشورة صالحة', 409, 'CONTENT_TOO_SMALL');
 await tx.$queryRawUnsafe('SELECT "id" FROM "Category" WHERE "id"=ANY($1::text[]) ORDER BY "id" FOR SHARE', [...new Set(chosen.map(q => q.categoryId))]);
 await tx.$queryRawUnsafe('SELECT "id" FROM "OrderingQuestion" WHERE "id"=ANY($1::text[]) ORDER BY "id" FOR SHARE', chosen.map(q => q.id));
 const latest = await tx.orderingQuestion.findMany({ where: { id: { in: chosen.map(q => q.id) }, status: 'PUBLISHED', category: { active: true } }, include: { category: { select: { title: true } }, items: true } }); const ids: string[] = [];
 for (const [i, old] of chosen.entries()) { const current = latest.find(q => q.id === old.id); if (!current) throw new OrderingError('تغير المحتوى؛ أعد المحاولة', 409); const snapshot = asQuestion(current); validateQuestion(snapshot); snapshot.presentation = shuffle(snapshot.items.map(i => i.id), randomInt); const round = await tx.gameRound.create({ data: { sessionId: session.id, number: s.matchNumber * ROUND_COUNT + i + 1 } }); const id = randomUUID(); ids.push(id); await tx.orderingQuestionUse.create({ data: { id, sessionId: session.id, questionId: current.id, matchNumber: s.matchNumber + 1, roundIndex: i, gameRoundId: round.id, snapshot: json(snapshot) } }); }
 return ids;
}
export async function applyOrderingCommand(id: string, hostId: string, key: string, expectedVersion: number, action: HostAction) {
 const hash = createHash('sha256').update(JSON.stringify({ hostId, action })).digest('hex');
 const outcome = await db().$transaction(async tx => { await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session); await authorize(tx, session!, s, { kind: 'HOST', id: hostId }, Date.now()); const prior = await tx.gameCommand.findUnique({ where: { sessionId_key: { sessionId: id, key } } }); if (prior) { if (prior.payloadHash !== hash) throw new OrderingError('معرف الأمر مستخدم لإجراء مختلف', 409, 'COMMAND_KEY_REUSED'); return 'DUPLICATE'; }
 const now = Date.now(); if (expired(s, now)) { await timeoutLocked(tx, session!, s, now); return 'EXPIRED'; } if (session!.stateVersion !== expectedVersion) throw new OrderingError('تغيرت المباراة؛ حدّث الحالة', 409, 'STALE_GAME_STATE'); let next: State;
 if (['START', 'REMATCH'].includes(action.type)) { assertPhase(s, action.type === 'START' ? 'LOBBY' : 'COMPLETED'); if (session!.teams.length !== 2 || session!.teams.some((t, i) => t.position !== i)) throw new OrderingError('ترتيب الفريقين غير صالح', 400); next = fresh(s, session!.teams.map(t => t.id), await select(tx, session!, s)); if (action.type === 'START') await consumeGameCredit(tx, hostId, id, Boolean(session!.creditConsumedAt)); await tx.orderingControllerAccess.updateMany({ where: { sessionId: id, revokedAt: null }, data: { revokedAt: new Date(now) } }); }
 else { const use = await currentUse(tx, s, action.type === 'NEXT_ROUND' && s.roundIndex + 1 < s.roundCount ? s.roundIndex + 1 : s.roundIndex); next = transition(s, use?.snapshot as unknown as Question | null, action, now); } await persist(tx, session!, s, next, key, hash, action.type, now); return 'ACCEPTED'; }, { timeout: 20000 });
 if (outcome === 'EXPIRED') throw new OrderingError('انتهت المهلة؛ كُشفت الجولة مرة واحدة', 409, 'TIMER_EXPIRED'); return { session: await getOrderingView(id, { kind: 'HOST', id: hostId }), duplicate: outcome === 'DUPLICATE' };
}
import { teamTransition } from './module';
export async function applyOrder(id: string, token: string, key: string, expectedRevision: number, action: TeamAction) {
 const outcome = await db().$transaction(async tx => { await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session), now = Date.now(); const a = (await authorize(tx, session!, s, { kind: 'CONTROLLER', token }, now))!;
 const hash = createHash('sha256').update(JSON.stringify({ teamId: a.teamId, matchNumber: a.matchNumber, type: action.type, roundNumber: action.roundNumber, order: action.order })).digest('hex'); const prior = await tx.gameCommand.findUnique({ where: { sessionId_key: { sessionId: id, key } } }); if (prior) { if (prior.payloadHash !== hash) throw new OrderingError('معرف الأمر مستخدم لإجراء مختلف', 409, 'COMMAND_KEY_REUSED'); return 'DUPLICATE'; }
 if (expired(s, now)) { await timeoutLocked(tx, session!, s, now); return 'EXPIRED'; } const use = await currentUse(tx, s); const next = teamTransition(s, use?.snapshot as unknown as Question, s.teamIds.indexOf(a.teamId), expectedRevision, action, now); await persist(tx, session!, s, next, key, hash, action.type, now); return 'ACCEPTED'; }, { timeout: 20000 });
 if (outcome === 'EXPIRED') throw new OrderingError('انتهت المهلة', 409, 'TIMER_EXPIRED'); return { session: await getOrderingView(id, { kind: 'CONTROLLER', token }), duplicate: outcome === 'DUPLICATE' };
}
export async function createOrderingControllerAccess(hostId: string, id: string, teamId: string) {
  const token = newToken(); const access = await db().$transaction(async tx => {
    await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session), now = Date.now();
    await authorize(tx, session!, s, { kind: "HOST", id: hostId }, now);
    if (s.matchNumber < 1 || ["FINAL_RESULTS", "COMPLETED", "ABANDONED"].includes(s.phase)) throw new OrderingError("أنشئ رابط الترتيب بعد بدء المباراة وأثناء اللعب", 409, "INVALID_PHASE");
    const index = s.teamIds.indexOf(teamId); if (index < 0) throw new OrderingError("الفريق لا ينتمي إلى المباراة", 400);
    await tx.orderingControllerAccess.updateMany({ where: { sessionId: id, teamId, revokedAt: null, expiresAt: { lte: new Date(now) } }, data: { revokedAt: new Date(now) } });
    const [active, recent] = await Promise.all([tx.orderingControllerAccess.count({ where: { sessionId: id, teamId, revokedAt: null, expiresAt: { gt: new Date(now) } } }), tx.orderingControllerAccess.count({ where: { sessionId: id, teamId, createdAt: { gte: new Date(now - CONTROLLER_LINK_WINDOW_MS) } } })]);
    if (active >= CONTROLLER_ACTIVE_LINKS_PER_TEAM || recent >= CONTROLLER_LINKS_PER_WINDOW) throw new OrderingError("وصلت إلى حد روابط ترتيب الفريق؛ ألغِ الرابط الحالي أولًا", 429, "CONTROLLER_LINK_LIMIT");
    return tx.orderingControllerAccess.create({ data: { sessionId: id, teamId, matchNumber: s.matchNumber, permission: index === 0 ? "ORDER_TEAM_A" : "ORDER_TEAM_B", tokenHash: tokenHash(token), expiresAt: new Date(now + CONTROLLER_TOKEN_TTL_MS) } });
  }); return { token, expiresAt: access.expiresAt };
}
export async function revokeOrderingControllerAccess(hostId: string, id: string, teamId: string) { await db().$transaction(async tx => { await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session); await authorize(tx, session!, s, { kind: "HOST", id: hostId }, Date.now()); if (!session!.teams.some(t => t.id === teamId)) throw new OrderingError("الفريق لا ينتمي إلى المباراة", 400); await tx.orderingControllerAccess.updateMany({ where: { sessionId: id, teamId, revokedAt: null }, data: { revokedAt: new Date() } }); }); }
export async function createOrderingDisplayAccess(hostId: string, id: string) {
  const token = newToken(); const expiresAt = await db().$transaction(async tx => {
    await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session), now = new Date(); await authorize(tx, session!, s, { kind: "HOST", id: hostId }, now.getTime());
    const end = displayWindowEndsAt(session!.endedAt, now); if (session!.endedAt && !end) throw new OrderingError("انتهت فترة العرض", 410);
    const [active, recent] = await Promise.all([tx.displayAccess.count({ where: { sessionId: id, revokedAt: null, expiresAt: { gt: now } } }), tx.displayAccess.count({ where: { sessionId: id, createdAt: { gte: new Date(now.getTime() - DISPLAY_LINK_WINDOW_MS) } } })]);
    if (active >= DISPLAY_ACTIVE_LINK_LIMIT || recent >= DISPLAY_LINKS_PER_WINDOW) throw new OrderingError("وصلت إلى حد روابط العرض", 429);
    const expiry = new Date(Math.min(now.getTime() + DISPLAY_TOKEN_TTL_MS, end?.getTime() ?? Infinity)); await tx.displayAccess.create({ data: { sessionId: id, tokenHash: tokenHash(token), expiresAt: expiry } }); return expiry;
  }); return { token, expiresAt };
}
export async function revokeOrderingDisplayAccess(hostId: string, id: string) { await db().$transaction(async tx => { await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session); await authorize(tx, session!, s, { kind: "HOST", id: hostId }, Date.now()); await tx.displayAccess.updateMany({ where: { sessionId: id, revokedAt: null }, data: { revokedAt: new Date() } }); }); }
