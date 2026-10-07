import { readDeadlineView, ViewDeadlineDue } from '@/lib/realtime/read-view';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { newToken, tokenHash } from '@/lib/auth/crypto';
import { consumeGameCredit } from '@/lib/billing/credits';
import { TEAM_COLORS } from '@/lib/design/team-colors';
import { recordEvent, type EventName } from '@/lib/analytics/events';
import { roomCode } from '@/lib/rooms/service';
import { DISPLAY_ACTIVE_LINK_LIMIT, DISPLAY_LINKS_PER_WINDOW, DISPLAY_LINK_WINDOW_MS, DISPLAY_TOKEN_TTL_MS, displayWindowEndsAt, displayAccessValid } from '@/lib/games/category-board/display-policy';
import { CourtError, lobby, fresh, transition, resolve, advance, expired, roles, phaseIs, bounded, validateCase, recentPool, winners, type State, type Case, type Choice, type Action } from './module';
export type Actor = { kind: 'HOST'; id: string } | { kind: 'JUROR' | 'DISPLAY'; token: string };
export const cookieName = (id: string) => `qalba_court_${id}`;
const include = { gameType: { select: { slug: true } }, teams: { orderBy: { position: 'asc' as const } }, room: true, courtParticipants: { orderBy: { position: 'asc' as const } } };
type Session = Prisma.GameSessionGetPayload<{ include: typeof include }>;
const json = (v: unknown) => v as Prisma.InputJsonValue;
const lock = (tx: Prisma.TransactionClient, id: string) => tx.$queryRawUnsafe('SELECT "id" FROM "GameSession" WHERE "id"=$1 FOR UPDATE', id);
function stateOf(session: Session | null): State { if (!session || session.gameType.slug !== 'the-court') throw new CourtError('الغرفة غير موجودة', 404); const s = session.state as unknown as State; if (s.module !== 'COURT' || s.schemaVersion !== 1) throw new CourtError('الجلسة ليست المحكمة', 404); return s; }
export function authorizeJuror(participants: { id: string; tokenHash: string; active: boolean; revokedAt: Date | null }[], token: string) { if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new CourtError('انتهى وصول المحلف', 403, 'PARTICIPANT_ACCESS_DENIED'); const p = participants.find(p => p.active && !p.revokedAt && p.tokenHash === tokenHash(token)); if (!p) throw new CourtError('انتهى وصول المحلف', 403, 'PARTICIPANT_ACCESS_DENIED'); return p.id; }
async function authorize(tx: Prisma.TransactionClient, session: Session, actor: Actor, now: number) {
  if (actor.kind === 'HOST') { if (session.hostId !== actor.id) throw new CourtError('غير مصرح بإدارة المحكمة', 403); return null; }
  if (actor.kind === 'JUROR') { if (!session.room || session.room.expiresAt.getTime() <= now) throw new CourtError('انتهت الغرفة', 403); return authorizeJuror(session.courtParticipants, actor.token); }
  if (!/^[A-Za-z0-9_-]{43}$/.test(actor.token)) throw new CourtError('رابط العرض غير صالح', 403);
  const access = await tx.displayAccess.findUnique({ where: { tokenHash: tokenHash(actor.token) } }); if (!access || access.sessionId !== session.id || !displayAccessValid(access, session, new Date(now))) throw new CourtError('انتهى وصول العرض', 403, 'DISPLAY_ACCESS_DENIED'); return null;
}
export async function jurorActor(id: string): Promise<Actor> { return { kind: 'JUROR', token: (await cookies()).get(cookieName(id))?.value ?? '' }; }
export async function createCourtSession(hostId: string, names: [string, string]) {
  const clean = names.map(n => bounded(n, 60)); if (clean.some(n => n.length < 2) || clean[0] === clean[1]) throw new CourtError('اختر اسمين مختلفين', 400);
  const game = await db().gameType.findUnique({ where: { slug: 'the-court' } }); if (!game?.enabled) throw new CourtError('اللعبة غير متاحة', 404);
  for (let attempt = 0; attempt < 8; attempt++) { try { const id = await db().$transaction(async tx => {
    const session = await tx.gameSession.create({ data: { hostId, gameTypeId: game.id, state: json(lobby()), config: { rounds: 5, preparationMs: 45000, argumentMs: 45000, rebuttalMs: 20000, votingMs: 30000, winPoints: 3, tiePoints: 1, rematchCredit: 'FREE_IN_SAME_SESSION' } } });
    await tx.team.createMany({ data: clean.map((name, position) => ({ sessionId: session.id, name, position, color: TEAM_COLORS[position] })) });
    const room = await tx.room.create({ data: { hostId, sessionId: session.id, code: roomCode(), expiresAt: new Date(Date.now() + 8 * 3600000) } });
    await recordEvent(tx, 'GAME_CREATED', hostId, { sessionId: session.id, gameSlug: 'the-court' }); await recordEvent(tx, 'ROOM_CREATED', hostId, { sessionId: session.id, roomId: room.id }); return session.id;
  }); return getCourtView(id, { kind: 'HOST', id: hostId }); } catch (e) { if ((e as { code?: string }).code !== 'P2002' || attempt === 7) throw e; } }
  throw new CourtError('تعذر إنشاء الغرفة', 503);
}
export async function previewCourt(code: string) {
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)) throw new CourtError('رمز الغرفة غير صالح', 400);
  const room = await db().room.findUnique({ where: { code }, include: { session: { include: { gameType: { select: { slug: true } } } } } });
  if (!room || room.expiresAt.getTime() <= Date.now() || room.session?.gameType.slug !== 'the-court') throw new CourtError('الغرفة غير متاحة', 404);
  const s = room.session.state as unknown as State; return { id: room.session.id, code: room.code, phase: s.phase };
}
export async function joinCourt(id: string, code: string, name: string, existingToken?: string, userId?: string) {
  const clean = bounded(name, 60); if (clean.length < 2) throw new CourtError('اكتب اسمًا من حرفين على الأقل', 400);
  if (existingToken) { try { const v = await getCourtView(id, { kind: 'JUROR', token: existingToken }); if (v.code !== code) throw new CourtError('رمز غير صالح', 400); return { id, participantId: v.self!.id }; } catch (e) { if (!(e instanceof CourtError && e.status === 403)) throw e; } }
  const token = newToken(); const joined = await db().$transaction(async tx => {
    await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session); phaseIs(s, 'LOBBY');
    if (!session!.room || session!.room.code !== code || session!.room.expiresAt.getTime() <= Date.now()) throw new CourtError('الغرفة غير متاحة', 404);
    if (userId === session!.hostId) throw new CourtError('المضيف يدير المحكمة؛ انضم من جهاز محلف', 400);
    const active = session!.courtParticipants.filter(p => p.active); if (active.length >= 12) throw new CourtError('الغرفة مكتملة', 400, 'JUROR_COUNT');
    if (active.some(p => p.name.toLocaleLowerCase('ar') === clean.toLocaleLowerCase('ar'))) throw new CourtError('الاسم مستخدم', 409);
    const p = await tx.courtParticipant.create({ data: { sessionId: id, name: clean, position: active.length, tokenHash: tokenHash(token) } });
    await tx.gameSession.update({ where: { id }, data: { stateVersion: { increment: 1 } } }); await tx.room.update({ where: { id: session!.room.id }, data: { version: { increment: 1 } } }); await recordEvent(tx, 'ROOM_JOINED', null, { sessionId: id, roomId: session!.room.id }); return { id: p.id, expiresAt: session!.room.expiresAt };
  });
  (await cookies()).set(cookieName(id), token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: joined.expiresAt }); return { id, participantId: joined.id };
}
const currentRound = (tx: Prisma.TransactionClient, s: State) => s.roundIds[s.roundIndex] ? tx.courtRound.findUnique({ where: { id: s.roundIds[s.roundIndex] }, include: { votes: true } }) : Promise.resolve(null);
export function publicProjection(s: State, c: Case | null, voteCount: number) {
  const phase = s.phase === 'PAUSED' ? s.pausedPhase : s.phase; const visible = c && !['LOBBY', 'READY', 'ABANDONED'].includes(phase!); const r = s.results.find(r => r.roundNumber === s.roundIndex + 1) ?? null;
  return { phase: s.phase, pausedPhase: s.pausedPhase, matchNumber: s.matchNumber, roundNumber: s.roundIndex + 1, roundCount: ROUND_COUNT, deadlineAt: s.deadlineAt === null ? null : new Date(s.deadlineAt).toISOString(), remainingMs: s.remainingMs, roles: roles(s), eligibleCount: s.eligibleIds.length, voteCount, case: visible ? { ...c, facts: [...c.facts] } : null, verdict: r ? { ...r, deltas: [...r.deltas] } : null, results: s.results.map(r => ({ ...r, deltas: [...r.deltas] })), winnerIds: ['FINAL_RESULTS', 'COMPLETED'].includes(s.phase) ? winners(s) : [], lastEvent: [...s.lastEvent] };
}
export function hostProjection(s: State, c: Case | null, count: number) { return { ...publicProjection(s, c, count), canUndo: s.undo.length > 0 && !(s.phase === 'PAUSED' || ['JURY_VOTING', 'VERDICT', 'ROUND_RESULTS', 'FINAL_RESULTS', 'COMPLETED'].includes(s.phase)), canCloseVoting: s.phase === 'JURY_VOTING' && count === s.eligibleIds.length, canVoid: ['VERDICT', 'ROUND_RESULTS'].includes(s.phase) && Boolean(s.results.at(-1)) && !s.results.at(-1)?.voided }; }
export const tvProjection = publicProjection;
export function jurorProjection(s: State, c: Case | null, count: number, selfId: string, choice: Choice | null) { if (!selfId) throw new CourtError('المحلف غير مصرح', 403); return { ...publicProjection(s, c, count), self: { id: selfId, voted: choice !== null, choice, eligible: s.eligibleIds.includes(selfId) }, canVote: s.phase === 'JURY_VOTING' && choice === null && s.eligibleIds.includes(selfId) }; }
export type CourtView = { id: string; version: number; serverNow: string; code: string; teams: { id: string; name: string; color: string; position: number; score: number }[]; participants: { id: string; name: string; position: number }[] } & ReturnType<typeof publicProjection> & Partial<Pick<ReturnType<typeof hostProjection>, 'canUndo' | 'canCloseVoting' | 'canVoid'>> & Partial<Pick<ReturnType<typeof jurorProjection>, 'self' | 'canVote'>>;
import { ROUND_COUNT } from './module';
async function persist(tx: Prisma.TransactionClient, session: Session, old: State, next: State, key: string, hash: string | null, type: string, now: number) {
  const added = next.results.length > old.results.length, voided = type === 'VOID_RESULT'; const round = (added || voided) ? await currentRound(tx, next) : null;
  for (const [i, team] of session.teams.entries()) {
    const delta = next.scores[i] - old.scores[i];
    if (delta) {
      await tx.team.update({ where: { id: team.id }, data: { score: next.scores[i] } });
      // Rematch resets the live scoreboard; it must retain prior match awards.
      if (added || voided) await tx.scoreEvent.create({ data: { sessionId: session.id, teamId: team.id, roundId: round!.gameRoundId, delta, reason: `COURT_${type}_M${next.matchNumber}_R${next.roundIndex + 1}`, commandKey: `${session.id}:${key}:${i}` } });
    }
  }
  if (added) { if (round!.scoredAt) throw new CourtError('الحكم محسوب', 409); await tx.courtRound.update({ where: { id: round!.id }, data: { scoredAt: new Date(now), scoreAudit: json(next.results.at(-1)) } }); await tx.gameRound.update({ where: { id: round!.gameRoundId }, data: { endedAt: new Date(now) } }); }
  if (voided) await tx.courtRound.update({ where: { id: round!.id }, data: { voidedAt: new Date(now), scoreAudit: json(next.results.at(-1)) } });
  await tx.gameCommand.create({ data: { sessionId: session.id, key, type, payloadHash: hash, stateVersion: session.stateVersion + 1 } });
  const update = await tx.gameSession.updateMany({ where: { id: session.id, stateVersion: session.stateVersion }, data: { state: json(next), stateVersion: { increment: 1 }, currentRoundNumber: next.roundIndex + 1, status: next.phase === 'LOBBY' ? 'LOBBY' : next.phase === 'READY' ? 'READY' : next.phase === 'PAUSED' ? 'PAUSED' : next.phase === 'COMPLETED' ? 'COMPLETED' : next.phase === 'ABANDONED' ? 'ABANDONED' : 'IN_PROGRESS', ...(type === 'START' ? { startedAt: new Date(now), creditConsumedAt: new Date(now) } : {}), ...(['COMPLETE', 'ABANDON'].includes(type) ? { endedAt: new Date(now) } : {}), ...(type === 'REMATCH' ? { endedAt: null } : {}) } }); if (update.count !== 1) throw new CourtError('تغيرت المباراة', 409, 'STALE_GAME_STATE');
  for (const event of next.lastEvent) if (courtEvents.has(event)) await recordEvent(tx, event as EventName, session.hostId, { sessionId: session.id, gameSlug: 'the-court' });
}
const courtEvents = new Set(['COURT_GAME_STARTED', 'COURT_ROUND_STARTED', 'COURT_PREPARATION_STARTED', 'COURT_ARGUMENT_STARTED', 'COURT_VOTING_STARTED', 'COURT_VOTE_RECEIVED', 'COURT_VERDICT_REVEALED', 'COURT_ROUND_COMPLETED', 'COURT_GAME_COMPLETED', 'COURT_GAME_PAUSED', 'COURT_GAME_RESUMED', 'COURT_RESULT_VOIDED', 'COURT_GAME_ABANDONED', 'COURT_PHASE_UNDONE', 'COURT_GAME_ENDED', 'COURT_FINAL_RESULTS']);
async function expireLocked(tx: Prisma.TransactionClient, session: Session, s: State, now: number, key?: string, hash?: string) { const r = s.phase === 'JURY_VOTING' ? await currentRound(tx, s) : null; const next = r ? resolve(s, r.votes.map(v => v.choice as Choice)) : advance(s, now, false); await persist(tx, session, s, next, key ?? `timer:${s.matchNumber}:${s.roundIndex}:${session.stateVersion}`, hash ?? null, 'TIMEOUT', now); return next; }
export async function getCourtView(id: string, actor: Actor): Promise<CourtView> {
  return readDeadlineView(id, lock, async (tx, resolveDue) => { let session = await tx.gameSession.findUnique({ where: { id }, include }); let s = stateOf(session); const selfId = await authorize(tx, session!, actor, Date.now()); if (expired(s, Date.now())) { if (!resolveDue) throw new ViewDeadlineDue(); s = await expireLocked(tx, session!, s, Date.now()); session = await tx.gameSession.findUnique({ where: { id }, include }); } const r = await currentRound(tx, s), c = r?.snapshot as unknown as Case | null, count = (r?.votes.length ?? 0) + (r?.retainedVoteCount ?? 0);
    return { id, version: session!.stateVersion, serverNow: new Date().toISOString(), code: session!.room!.code, teams: session!.teams.map((t, i) => ({ id: t.id, name: t.name, position: t.position, color: t.color, score: s.scores[i] })), participants: session!.courtParticipants.filter(p => p.active).map(p => ({ id: p.id, name: p.name, position: p.position })), ...(actor.kind === 'HOST' ? hostProjection(s, c, count) : actor.kind === 'DISPLAY' ? tvProjection(s, c, count) : jurorProjection(s, c, count, selfId!, r?.votes.find(v => v.participantId === selfId)?.choice as Choice ?? null)) };
  });
}
async function selectCases(tx: Prisma.TransactionClient, session: Session, s: State) {
  const [bank, recent] = await Promise.all([tx.courtCase.findMany({ where: { status: 'PUBLISHED', locale: 'ar-SA', category: { active: true } }, include: { category: true, facts: { orderBy: { position: 'asc' } } }, take: 3000, orderBy: { id: 'asc' } }), tx.courtRound.findMany({ where: { session: { hostId: session.hostId } }, orderBy: { selectedAt: 'desc' }, take: 100, select: { caseId: true } })]);
  const snapshot = (q: typeof bank[number]): Case => ({ title: q.title, scenario: q.scenario, prosecutionPrompt: q.prosecutionPrompt, defensePrompt: q.defensePrompt, rebuttalPrompt: q.rebuttalPrompt, category: q.category.title, difficulty: q.difficulty, locale: q.locale, contentRating: q.contentRating, facts: q.facts.map(f => f.text) });
  const chosen = recentPool(bank.filter(q => { try { return validateCase(snapshot(q)); } catch { return false; } }), recent.map(r => r.caseId), randomInt).slice(0, ROUND_COUNT); if (chosen.length !== ROUND_COUNT) throw new CourtError('يلزم خمس قضايا منشورة صالحة', 409, 'CONTENT_TOO_SMALL');
  await tx.$queryRawUnsafe('SELECT "id" FROM "Category" WHERE "id"=ANY($1::text[]) ORDER BY "id" FOR SHARE', [...new Set(chosen.map(q => q.categoryId))]); await tx.$queryRawUnsafe('SELECT "id" FROM "CourtCase" WHERE "id"=ANY($1::text[]) ORDER BY "id" FOR SHARE', chosen.map(q => q.id));
  const latest = await tx.courtCase.findMany({ where: { id: { in: chosen.map(q => q.id) }, status: 'PUBLISHED', category: { active: true } }, include: { category: true, facts: { orderBy: { position: 'asc' } } } }); const ids: string[] = [];
  for (const [i, q] of chosen.entries()) { const current = latest.find(c => c.id === q.id); if (!current) throw new CourtError('تغير المحتوى؛ أعد المحاولة'); const c = snapshot(current); validateCase(c); const gr = await tx.gameRound.create({ data: { sessionId: session.id, number: s.matchNumber * ROUND_COUNT + i + 1 } }); const id = randomUUID(); ids.push(id); await tx.courtRound.create({ data: { id, sessionId: session.id, caseId: q.id, matchNumber: s.matchNumber + 1, number: i + 1, gameRoundId: gr.id, snapshot: json(c) } }); }
  return ids;
}
export async function applyCourtCommand(id: string, hostId: string, key: string, expectedVersion: number, action: Action) {
  const hash = createHash('sha256').update(JSON.stringify({ hostId, action })).digest('hex'); const outcome = await db().$transaction(async tx => {
    await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session); await authorize(tx, session!, { kind: 'HOST', id: hostId }, Date.now());
    const prior = await tx.gameCommand.findUnique({ where: { sessionId_key: { sessionId: id, key } } }); if (prior) { if (prior.payloadHash !== hash) throw new CourtError('معرف الأمر مستخدم لإجراء مختلف', 409, 'COMMAND_KEY_REUSED'); return 'DUPLICATE'; }
    const now = Date.now(); if (expired(s, now)) { const closing = action.type === 'CLOSE_VOTING' && s.phase === 'JURY_VOTING'; await expireLocked(tx, session!, s, now, closing ? key : undefined, closing ? hash : undefined); return closing ? 'ACCEPTED' : 'EXPIRED'; }
    if (session!.stateVersion !== expectedVersion) throw new CourtError('تغيرت المباراة؛ حدث الحالة', 409, 'STALE_GAME_STATE'); let next: State;
    if (action.type === 'START' || action.type === 'REMATCH') { phaseIs(s, action.type === 'START' ? 'LOBBY' : 'COMPLETED'); if (session!.teams.length !== 2 || session!.teams.some((t, i) => t.position !== i)) throw new CourtError('ترتيب الفريقين غير صالح', 400); const jurors = session!.courtParticipants.filter(p => p.active); next = fresh(s, session!.teams.map(t => t.id), jurors.map(p => p.id), await selectCases(tx, session!, s)); await tx.team.updateMany({ where: { sessionId: id }, data: { score: 0 } }); if (action.type === 'START') await consumeGameCredit(tx, hostId, id, Boolean(session!.creditConsumedAt)); }
    else if (action.type === 'REMOVE_PARTICIPANT') { phaseIs(s, 'LOBBY'); const p = session!.courtParticipants.find(p => p.id === action.participantId && p.active); if (!p) throw new CourtError('المحلف غير موجود', 404); await tx.courtParticipant.update({ where: { id: p.id }, data: { active: false, revokedAt: new Date(now) } }); for (const [i, p] of session!.courtParticipants.filter(p => p.active && p.id !== action.participantId).entries()) await tx.courtParticipant.update({ where: { id: p.id }, data: { position: i } }); await tx.room.update({ where: { id: session!.room!.id }, data: { version: { increment: 1 } } }); next = { ...s, lastEvent: ['COURT_PARTICIPANT_REMOVED'] }; }
    else if (action.type === 'CLOSE_VOTING') { phaseIs(s, 'JURY_VOTING'); const r = (await currentRound(tx, s))!; if (r.votes.length !== s.eligibleIds.length) throw new CourtError('انتظر الأصوات أو نهاية المهلة', 409, 'VOTING_STILL_OPEN'); next = resolve(s, r.votes.map(v => v.choice as Choice)); }
    else next = transition(s, action, now); await persist(tx, session!, s, next, key, hash, action.type, now); return 'ACCEPTED';
  }, { timeout: 20000 }); if (outcome === 'EXPIRED') throw new CourtError('انتهت المهلة وحسمت المرحلة', 409, 'TIMER_EXPIRED'); return { session: await getCourtView(id, { kind: 'HOST', id: hostId }), duplicate: outcome === 'DUPLICATE' };
}
export async function submitCourtVote(id: string, token: string, key: string, matchNumber: number, roundNumber: number, choice: Choice) {
  const outcome = await db().$transaction(async tx => {
    await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }), s = stateOf(session), now = Date.now(), selfId = (await authorize(tx, session!, { kind: 'JUROR', token }, now))!;
    if (matchNumber !== s.matchNumber || roundNumber !== s.roundIndex + 1) throw new CourtError('انتهت الجولة السابقة', 409, 'ROUND_CHANGED');
    const hash = createHash('sha256').update(JSON.stringify({ selfId, matchNumber, roundNumber, choice })).digest('hex'), prior = await tx.gameCommand.findUnique({ where: { sessionId_key: { sessionId: id, key } } }); if (prior) { if (prior.payloadHash !== hash) throw new CourtError('معرف الأمر مستخدم لإجراء مختلف', 409, 'COMMAND_KEY_REUSED'); return 'DUPLICATE'; }
    if (expired(s, now)) { await expireLocked(tx, session!, s, now); return 'EXPIRED'; }
    phaseIs(s, 'JURY_VOTING'); if (!s.eligibleIds.includes(selfId) || !['PROSECUTION', 'DEFENSE'].includes(choice)) throw new CourtError('تصويت غير صالح', 400);
    const r = (await currentRound(tx, s))!; if (r.votes.some(v => v.participantId === selfId)) throw new CourtError('سجل صوتك بالفعل', 409, 'VOTE_ALREADY_SUBMITTED');
    await tx.courtRoundVote.create({ data: { roundId: r.id, participantId: selfId, choice } });
    const choices = [...r.votes.map(v => v.choice as Choice), choice];
    const next = choices.length === s.eligibleIds.length ? { ...resolve(s, choices), lastEvent: ['COURT_VOTE_RECEIVED', 'COURT_VERDICT_REVEALED'] } : { ...s, lastEvent: ['COURT_VOTE_RECEIVED'] };
    await persist(tx, session!, s, next, key, hash, 'VOTE', now); return 'ACCEPTED';
  }, { timeout: 20000 }); if (outcome === 'EXPIRED') throw new CourtError('انتهت مهلة التصويت', 409, 'TIMER_EXPIRED'); return { session: await getCourtView(id, { kind: 'JUROR', token }), duplicate: outcome === 'DUPLICATE' };
}

export async function createCourtDisplayAccess(hostId: string, id: string) {
  const token = newToken(); const expiresAt = await db().$transaction(async tx => {
    await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }); stateOf(session); const now = new Date(); await authorize(tx, session!, { kind: "HOST", id: hostId }, now.getTime());
    const end = displayWindowEndsAt(session!.endedAt, now); if (session!.endedAt && !end) throw new CourtError("انتهت فترة العرض", 410);
    const [active, recent] = await Promise.all([tx.displayAccess.count({ where: { sessionId: id, revokedAt: null, expiresAt: { gt: now } } }), tx.displayAccess.count({ where: { sessionId: id, createdAt: { gte: new Date(now.getTime() - DISPLAY_LINK_WINDOW_MS) } } })]);
    if (active >= DISPLAY_ACTIVE_LINK_LIMIT || recent >= DISPLAY_LINKS_PER_WINDOW) throw new CourtError("وصلت إلى حد روابط العرض", 429);
    const expiry = new Date(Math.min(now.getTime() + DISPLAY_TOKEN_TTL_MS, end?.getTime() ?? Infinity)); await tx.displayAccess.create({ data: { sessionId: id, tokenHash: tokenHash(token), expiresAt: expiry } }); return expiry;
  }); return { token, expiresAt };
}
export async function revokeCourtDisplayAccess(hostId: string, id: string) { await db().$transaction(async tx => { await lock(tx, id); const session = await tx.gameSession.findUnique({ where: { id }, include }); stateOf(session); await authorize(tx, session!, { kind: "HOST", id: hostId }, Date.now()); await tx.displayAccess.updateMany({ where: { sessionId: id, revokedAt: null }, data: { revokedAt: new Date() } }); }); }
