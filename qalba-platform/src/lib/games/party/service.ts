import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { consumeGameCredit } from "@/lib/billing/credits";
import { recordEvent } from "@/lib/analytics/events";
import { TEAM_COLORS } from "@/lib/design/team-colors";
import { isLaunchCreationAllowed } from "@/lib/games/launch-policy";
import { letterGrid } from "./content";
import { modules } from "./registry";
import { copy, current, PartyError, requirePhase, timer, type Card, type PartyAction, type PartySlug, type PartyState } from "./types";

const colors = TEAM_COLORS;
export async function createPartySession(hostId: string, slug: PartySlug, input: { teamNames: string[]; playerNames: string[]; timerSeconds: number }) {
  if (!isLaunchCreationAllowed(slug, `/api/games/party/${slug}`)) throw new PartyError("اللعبة غير متاحة", 404);
  const game = await db().gameType.findUnique({ where: { slug } });
  if (!game?.enabled || !modules[slug]) throw new PartyError("اللعبة غير متاحة", 404);
  const isPlayers = slug === "bluff" || slug === "party-court";
  if (isPlayers && (input.playerNames.length < 3 || input.playerNames.length > 10 || new Set(input.playerNames).size !== input.playerNames.length)) throw new PartyError("اختر ٣ إلى ١٠ أسماء مختلفة");
  if (input.teamNames.length !== 2 || new Set(input.teamNames).size !== 2) throw new PartyError("اختر فريقين مختلفين");
  const [questions, history] = await Promise.all([
    db().question.findMany({ where: { gameTypeId: game.id, status: "PUBLISHED", language: "ar" }, select: { id: true, question: true, answer: true, alternativeAnswers: true, type: true, options: true, pointValue: true }, orderBy: { id: "asc" } }),
    db().questionHistory.findMany({ where: { userId: hostId }, select: { questionId: true, lastPlayedAt: true } }),
  ]);
  const recent = new Map(history.map(row => [row.questionId, row.lastPlayedAt.getTime()]));
  const ordered = [...questions].sort((a, b) => (recent.get(a.id) ?? 0) - (recent.get(b.id) ?? 0));
  const toCard = (q: typeof questions[number]): Card => ({ id: q.id, question: q.question, answer: q.answer, alternativeAnswers: q.alternativeAnswers, type: q.type, options: q.options, pointValue: q.pointValue });
  let cards: Card[];
  if (slug === "letter-battle") {
    const used = new Set<string>();
    cards = letterGrid.map(letter => { const q = ordered.find(item => !used.has(item.id) && (item.options as { letter?: string } | null)?.letter === letter); if (!q) throw new PartyError("محتوى الحروف غير كافٍ", 409); used.add(q.id); return toCard(q); });
    cards.push(...ordered.filter(q => !used.has(q.id)).map(toCard));
  } else cards = ordered.slice(0, slug === "fastest-mind" ? 5 : slug === "secret-word" ? 4 : 3).map(toCard);
  if (!cards.length || (slug === "letter-battle" && cards.length < 16)) throw new PartyError("أسئلة اللعبة غير متاحة", 409);
  const id = randomUUID(), teamIds = [randomUUID(), randomUUID()], playerIds = input.playerNames.map(() => randomUUID());
  const state: PartyState = { schemaVersion: 1, slug, cards, index: 0, phase: "LOBBY", revealed: false, teamIds, playerIds, timerSeconds: input.timerSeconds,
    deadlineAt: null, remainingMs: input.timerSeconds * 1000, turn: 0, owners: slug === "letter-battle" ? Array(16).fill(null) : [],
    selected: null, found: [], strikes: 0, fakes: {}, votes: {}, clues: [], winnerId: null, lastCapture: null };
  await db().$transaction(async tx => {
    await tx.gameSession.create({ data: { id, hostId, gameTypeId: game.id, config: { timerSeconds: input.timerSeconds }, state: state as unknown as Prisma.InputJsonValue } });
    await recordEvent(tx, "GAME_CREATED", hostId, { sessionId: id, gameSlug: slug });
    await tx.team.createMany({ data: teamIds.map((teamId, i) => ({ id: teamId, sessionId: id, name: input.teamNames[i], color: colors[i] })) });
    if (playerIds.length) await tx.player.createMany({ data: playerIds.map((playerId, i) => ({ id: playerId, sessionId: id, name: input.playerNames[i] })) });
  });
  return getPartySession(hostId, id);
}

export async function getPartySession(hostId: string, id: string, display = false) {
  const session = await db().gameSession.findUnique({ where: { id }, include: { gameType: true, teams: true, players: true } });
  if (!session || !(session.gameType.slug in modules)) throw new PartyError("المباراة غير موجودة", 404);
  if (session.hostId !== hostId) throw new PartyError("غير مصرح لك بعرض المباراة", 403);
  const state = session.state as unknown as PartyState;
  if (state.slug !== session.gameType.slug) throw new PartyError("المباراة لا تتبع هذه الوحدة", 404);
  if (state.schemaVersion !== 1) throw new PartyError("إصدار المباراة غير مدعوم", 500);
  return { id, slug: state.slug, title: session.gameType.title, status: session.status, version: session.stateVersion, state: modules[state.slug].project(state, display),
    teams: session.teams.map(t => ({ id: t.id, name: t.name, color: t.color, score: t.score })),
    players: session.players.map(p => ({ id: p.id, name: p.name, score: p.score })), createdAt: session.createdAt, endedAt: session.endedAt };
}

export async function applyPartyCommand(hostId: string, id: string, key: string, expectedVersion: number, action: PartyAction) {
  try {
    const duplicate = await db().$transaction(async tx => {
      const session = await tx.gameSession.findUnique({ where: { id }, include: { gameType: true } });
      if (!session || !(session.gameType.slug in modules)) throw new PartyError("المباراة غير موجودة", 404);
      if (session.hostId !== hostId) throw new PartyError("غير مصرح لك بإدارة المباراة", 403);
      const state = session.state as unknown as PartyState;
      if (state.slug !== session.gameType.slug) throw new PartyError("المباراة لا تتبع هذه الوحدة", 404);
      if (await tx.gameCommand.findUnique({ where: { sessionId_key: { sessionId: id, key } } })) return true;
      if (session.stateVersion !== expectedVersion) throw new PartyError("تغيرت المباراة. حدّث الصفحة", 409);
      if (state.schemaVersion !== 1) throw new PartyError("إصدار المباراة غير مدعوم", 500);
      let decision;
      if (action.type === "START") { requirePhase(state, "LOBBY"); await consumeGameCredit(tx, hostId, id, Boolean(session.creditConsumedAt)); const next = copy(state);
        next.phase = state.slug === "letter-battle" ? "BOARD" : state.slug === "bluff" ? "SUBMIT" : state.slug === "party-court" ? "ARGUE" : "QUESTION"; decision = { state: next, opened: state.slug === "letter-battle" ? undefined : current(next).id }; }
      else if (action.type === "END") { if (state.phase === "LOBBY" || state.phase === "DONE") throw new PartyError("لا يمكن إنهاء المباراة الآن", 409); const next = copy(state); next.phase = "DONE"; next.deadlineAt = null; decision = { state: next, completed: true }; }
      else if (action.type === "PAUSE") { requirePhase(state, "BOARD", "QUESTION", "SUBMIT", "VOTE", "RESULT", "ARGUE", "STEAL"); const next = copy(state); next.remainingMs = next.deadlineAt ? Math.max(0, new Date(next.deadlineAt).getTime() - Date.now()) : next.remainingMs; next.deadlineAt = null; next.phase = `PAUSED:${state.phase}`; decision = { state: next }; }
      else if (action.type === "RESUME") { if (!state.phase.startsWith("PAUSED:")) throw new PartyError("المباراة ليست متوقفة", 409); const next = copy(state); next.phase = next.phase.slice(7); decision = { state: next }; }
      else decision = timer(state, action) ?? modules[state.slug].decide(state, action);
      const nextState = decision.state;
      const completed = nextState.phase === "DONE";
      const version = await tx.gameSession.updateMany({ where: { id, stateVersion: expectedVersion }, data: { state: nextState as unknown as Prisma.InputJsonValue,
        stateVersion: { increment: 1 }, status: completed ? "COMPLETED" : nextState.phase.startsWith("PAUSED:") ? "PAUSED" : "IN_PROGRESS",
        startedAt: action.type === "START" ? new Date() : undefined, creditConsumedAt: action.type === "START" ? new Date() : undefined,
        endedAt: completed ? new Date() : session.status === "COMPLETED" ? null : undefined, currentQuestionId: nextState.phase === "DONE" || nextState.phase === "BOARD" ? null : current(nextState)?.id,
        currentRoundNumber: decision.opened ? session.currentRoundNumber + 1 : undefined } });
      if (!version.count) throw new PartyError("تغيرت المباراة في نافذة أخرى", 409);
      if (action.type === "START") await recordEvent(tx, "GAME_STARTED", hostId, { sessionId: id, gameSlug: state.slug });
      if (completed && session.status !== "COMPLETED") await recordEvent(tx, "GAME_COMPLETED", hostId, { sessionId: id, gameSlug: state.slug });
      if (decision.opened) await recordEvent(tx, "QUESTION_OPENED", hostId, { sessionId: id, questionId: decision.opened });
      if (["CAPTURE", "ANSWER", "JUDGE", "RESULT", "GUESS", "VOTE"].includes(action.type) && current(state)?.id) await recordEvent(tx, "QUESTION_ANSWERED", hostId, { sessionId: id, questionId: current(state).id });
      if (decision.opened) {
        await tx.gameRound.create({ data: { sessionId: id, number: session.currentRoundNumber + 1 } });
        await tx.sessionQuestion.createMany({ data: [{ sessionId: id, questionId: decision.opened }], skipDuplicates: true });
        await tx.questionHistory.upsert({ where: { userId_questionId: { userId: hostId, questionId: decision.opened } }, create: { userId: hostId, questionId: decision.opened }, update: { lastPlayedAt: new Date(), playCount: { increment: 1 } } });
      }
      for (const [i, score] of (decision.scores ?? []).entries()) {
        if (score.teamId) { if (!state.teamIds.includes(score.teamId)) throw new PartyError("فريق غير صالح"); await tx.team.update({ where: { id: score.teamId, sessionId: id }, data: { score: { increment: score.delta } } }); }
        if (score.playerId) { if (!state.playerIds.includes(score.playerId)) throw new PartyError("لاعب غير صالح"); await tx.player.update({ where: { id: score.playerId, sessionId: id }, data: { score: { increment: score.delta } } }); }
        await tx.scoreEvent.create({ data: { sessionId: id, teamId: score.teamId, playerId: score.playerId, delta: score.delta, reason: score.reason, commandKey: `${id}:${key}:${i}` } });
      }
      await tx.gameCommand.create({ data: { sessionId: id, key, type: action.type, stateVersion: expectedVersion + 1 } });
      return false;
    });
    return { session: await getPartySession(hostId, id), duplicate };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002" && await db().gameCommand.findUnique({ where: { sessionId_key: { sessionId: id, key } } })) return { session: await getPartySession(hostId, id), duplicate: true };
    throw error;
  }
}
