import { createHash, randomUUID } from "node:crypto";
import { recordEvent } from "@/lib/analytics/events";
import { TEAM_COLORS } from "@/lib/design/team-colors";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { consumeGameCredit } from "@/lib/billing/credits";
import { selectQuestion } from "@/lib/questions/selection";
import { BOARD_VALUES, BOARD_TILES_PER_VALUE, decideBoard, GameRuleError, initialBoardState,
  type BoardCommand, type BoardQuestion, type BoardState } from "./module";
import { displayWindowEndsAt } from "./display-policy";

const supportedTypes = ["TEXT", "MULTIPLE_CHOICE", "TRUE_FALSE", "IMAGE"] as const;
const colors = TEAM_COLORS;

export async function eligibleBoardCategories() {
  const game = await db().gameType.findUnique({ where: { slug: "category-board" } });
  if (!game?.enabled) return [];
  const [categories, counts] = await Promise.all([
    db().category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, title: true } }),
    db().question.groupBy({ by: ["categoryId", "pointValue"], where: {
      gameTypeId: game.id, status: "PUBLISHED", language: "ar", type: { in: [...supportedTypes] }, pointValue: { in: [...BOARD_VALUES] },
    }, _count: { id: true } }),
  ]);
  const ready = new Set(counts.filter((item) => item._count.id >= BOARD_TILES_PER_VALUE).map((item) => `${item.categoryId}:${item.pointValue}`));
  return categories.filter((category) => BOARD_VALUES.every((value) => ready.has(`${category.id}:${value}`)));
}

export async function createBoardSession(hostId: string, input: { categoryIds: string[]; teamNames: [string, string]; timerSeconds: number }) {
  const eligible = await eligibleBoardCategories();
  if (input.categoryIds.length !== 6 || new Set(input.categoryIds).size !== 6 ||
    !input.categoryIds.every((id) => eligible.some((category) => category.id === id))) {
    throw new GameRuleError("اختر ست فئات لديها أربعة أسئلة منشورة وصالحة على الأقل لكل مستوى: ٢٠٠ و٤٠٠ و٦٠٠", 400);
  }
  if (input.teamNames[0].trim() === input.teamNames[1].trim()) throw new GameRuleError("اختر اسمين مختلفين للفريقين", 400);
  const game = await db().gameType.findUniqueOrThrow({ where: { slug: "category-board" } });
  const [questions, history, powerUps] = await Promise.all([
    db().question.findMany({ where: { gameTypeId: game.id, categoryId: { in: input.categoryIds }, status: "PUBLISHED",
      language: "ar", pointValue: { in: [...BOARD_VALUES] }, type: { in: [...supportedTypes] } },
      select: { id: true, categoryId: true, pointValue: true, difficulty: true,
        question: true, answer: true, explanation: true, type: true, options: true, imageUrl: true } }),
    db().questionHistory.findMany({ where: { userId: hostId }, select: { questionId: true, lastPlayedAt: true } }),
    db().powerUp.findMany({ where: { gameTypeId: game.id, enabled: true } }),
  ]);
  const usedInSession = new Set<string>();
  const cells = input.categoryIds.flatMap(categoryId => BOARD_VALUES.flatMap(value => {
    const bucket = questions.filter(q => q.categoryId === categoryId && q.pointValue === value);
    if (bucket.length < BOARD_TILES_PER_VALUE)
      throw new GameRuleError("فئة ناقصة: يلزم أربعة أسئلة مختلفة لكل مستوى. حدّث الصفحة وحاول مجددًا", 409);
    return Array.from({ length: BOARD_TILES_PER_VALUE }, (_, slot) => {
      const chosen = selectQuestion(bucket, history, usedInSession);
      if (!chosen) throw new GameRuleError("محتوى إحدى الفئات لم يعد متاحًا. حدّث الصفحة وحاول مجددًا", 409);
      usedInSession.add(chosen.id);
      return { key: `${categoryId}:${value}:${slot + 1}`, categoryId, value, questionId: chosen.id, completed: false };
    });
  }));
  const questionSnapshots: Record<string, BoardQuestion> = {};
  for (const cell of cells) {
    const question = questions.find((item) => item.id === cell.questionId)!;
    questionSnapshots[question.id] = { id: question.id, question: question.question, answer: question.answer,
      explanation: question.explanation, type: question.type,
      options: Array.isArray(question.options) ? question.options.map(String) : null, imageUrl: question.imageUrl };
  }
  const teamIds = [randomUUID(), randomUUID()];
  const sessionId = randomUUID();
  const state = initialBoardState(input.categoryIds.map((id) => eligible.find((category) => category.id === id)!), teamIds, cells, questionSnapshots, input.timerSeconds);
  await db().$transaction(async (tx) => {
    await tx.gameSession.create({ data: { id: sessionId, hostId, gameTypeId: game.id,
      config: { categoryIds: input.categoryIds, timerSeconds: input.timerSeconds }, state: state as unknown as Prisma.InputJsonValue } });
    await recordEvent(tx, "GAME_CREATED", hostId, { sessionId, gameSlug: "category-board" });
    await tx.team.createMany({ data: teamIds.map((id, index) => ({ id, sessionId, name: input.teamNames[index], color: colors[index], position: index })) });
    for (const teamId of teamIds) for (const powerUp of powerUps) {
      const config = powerUp.config as { initialCount?: number };
      const count = config.initialCount;
      await tx.sessionPowerUp.create({ data: { sessionId, teamId, powerUpId: powerUp.id,
        remaining: Number.isInteger(count) && count! >= 0 && count! <= 10 ? count : 1 } });
    }
  });
  return getBoardSession(hostId, sessionId);
}

export async function getBoardSession(hostId: string, sessionId: string) {
  const now = new Date();
  const session = await db().gameSession.findUnique({ where: { id: sessionId },
    include: { gameType: { select: { slug: true } }, teams: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      commands: { orderBy: [{ stateVersion: "desc" }], take: 1, select: { type: true } },
      displayAccesses: { where: { revokedAt: null, expiresAt: { gt: now } }, orderBy: { expiresAt: "desc" }, take: 1, select: { expiresAt: true } },
      powerUps: { include: { powerUp: { select: { slug: true, title: true, enabled: true } } } } } });
  if (!session || session.gameType.slug !== "category-board") throw new GameRuleError("المباراة غير موجودة", 404);
  if (session.hostId !== hostId) throw new GameRuleError("غير مصرح لك بإدارة هذه المباراة", 403);
  const state = session.state as unknown as BoardState;
  if (state.schemaVersion !== 1) throw new GameRuleError("إصدار المباراة غير مدعوم", 500);
  const activeQuestion = state.active ? state.questionSnapshots[state.active.questionId] : null;
  const active = state.active;
  const choices = activeQuestion?.options;
  const displayAccess = session.endedAt && !displayWindowEndsAt(session.endedAt, now) ? undefined : session.displayAccesses[0];
  return { id: session.id, status: session.status, version: session.stateVersion, serverNow: new Date().toISOString(),
    displayAccess: { active: Boolean(displayAccess), expiresAt: displayAccess?.expiresAt ?? null },
    lastCommandType: session.commands[0]?.type ?? null,
    startedAt: session.startedAt, endedAt: session.endedAt, round: session.currentRoundNumber,
    categories: state.categories, cells: state.cells.map(({ key, categoryId, value, completed }) => ({ key, categoryId, value, completed })),
    teams: session.teams.map(({ id, name, color, score, position }) => ({ id, name, color, score, position })), turnTeamId: state.turnTeamId,
    timerSeconds: state.timerSeconds, endedEarly: state.endedEarly,
    canUndo: Boolean(state.undoStack?.length || state.lastManualScore || (state.lastJudgment && !state.endedEarly)),
    active: active && activeQuestion ? {
      questionId: active.questionId,
      categoryId: state.cells.find((cell) => cell.key === active.cellKey)?.categoryId,
      value: state.cells.find((cell) => cell.key === active.cellKey)?.value,
      question: activeQuestion.question, type: activeQuestion.type, imageUrl: activeQuestion.imageUrl,
      options: Array.isArray(choices) ? choices.filter((_, index) => !active.removedOptions.includes(index)) : null,
      answer: active.revealed ? activeQuestion.answer : null,
      explanation: active.revealed ? activeQuestion.explanation : null,
      revealed: active.revealed, originalTeamId: active.originalTeamId, answeringTeamId: active.answeringTeamId,
      phase: active.phase, double: active.double, shield: active.shield,
      remainingMs: active.remainingMs, deadlineAt: active.deadlineAt,
    } : null,
    powerUps: session.powerUps.filter((item) => item.powerUp.enabled).map((item) => ({
      teamId: item.teamId, slug: item.powerUp.slug, title: item.powerUp.title, remaining: item.remaining,
    })),
  };
}

export async function applyBoardCommand(hostId: string, sessionId: string, key: string, expectedVersion: number, command: BoardCommand) {
  const payloadHash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  try {
    const duplicate = await db().$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({ where: { id: sessionId }, include: { gameType: { select: { slug: true } } } });
      if (!session || session.gameType.slug !== "category-board") throw new GameRuleError("المباراة غير موجودة", 404);
      if (session.hostId !== hostId) throw new GameRuleError("غير مصرح لك بإدارة هذه المباراة", 403);
      const priorCommand = await tx.gameCommand.findUnique({ where: { sessionId_key: { sessionId, key } } });
      if (priorCommand) {
        if (priorCommand.payloadHash !== payloadHash) throw new GameRuleError("معرّف الأمر مستخدم لإجراء مختلف", 409, "COMMAND_KEY_REUSED");
        return true;
      }
      // Reserve the unique key before reading the version. PostgreSQL makes a
      // concurrent insert of this key wait for the winning transaction to commit.
      // Rollback also removes this reservation if the command fails.
      await tx.gameCommand.create({ data: { sessionId, key, type: command.type, payloadHash, stateVersion: expectedVersion + 1 } });
      if (session.stateVersion !== expectedVersion) throw new GameRuleError("تغيرت المباراة في نافذة أخرى. حدّث الصفحة", 409, "STALE_GAME_STATE");
      const state = session.state as unknown as BoardState;
      if (state.schemaVersion !== 1) throw new GameRuleError("إصدار المباراة غير مدعوم", 500);
      const activeQuestion = state.active ? state.questionSnapshots[state.active.questionId] : null;
      let availablePower: Awaited<ReturnType<typeof tx.sessionPowerUp.findFirst>> & { powerUp?: { config: Prisma.JsonValue } } | null = null;
      if (command.type === "USE_POWERUP") {
        const teamId = command.slug === "challenge" ? state.active?.originalTeamId : state.active?.answeringTeamId;
        availablePower = await tx.sessionPowerUp.findFirst({ where: { sessionId, teamId, powerUp: { slug: command.slug, enabled: true } },
          include: { powerUp: true } });
      }
      const powerConfig = availablePower?.powerUp?.config as { seconds?: number } | undefined;
      const decision = decideBoard(state, command, new Date(), {
        question: activeQuestion, powerRemaining: availablePower?.remaining, powerSeconds: powerConfig?.seconds,
      });
      if (command.type === "START") await consumeGameCredit(tx, hostId, sessionId, Boolean(session.creditConsumedAt));
      const updated = await tx.gameSession.updateMany({ where: { id: sessionId, stateVersion: expectedVersion }, data: {
        state: decision.state as unknown as Prisma.InputJsonValue, stateVersion: { increment: 1 },
        status: decision.state.completed ? "COMPLETED" : decision.state.paused ? "PAUSED" : decision.state.started ? "IN_PROGRESS" : "LOBBY",
        startedAt: command.type === "START" ? new Date() : undefined,
        creditConsumedAt: command.type === "START" && !session.creditConsumedAt ? new Date() : undefined,
        endedAt: decision.state.completed && session.status !== "COMPLETED" ? new Date() : decision.roundReopened ? null : undefined,
        currentQuestionId: decision.state.active?.questionId ?? null,
        currentRoundNumber: decision.openedQuestionId ? session.currentRoundNumber + 1 : undefined,
      } });
      if (updated.count !== 1) throw new GameRuleError("تغيرت المباراة في نافذة أخرى. حدّث الصفحة", 409, "STALE_GAME_STATE");
      if (command.type === "START") await recordEvent(tx, "GAME_STARTED", hostId, { sessionId, gameSlug: "category-board" });
      if (decision.state.completed && session.status !== "COMPLETED") await recordEvent(tx, "GAME_COMPLETED", hostId, { sessionId, gameSlug: "category-board" });
      if (decision.openedQuestionId) await recordEvent(tx, "QUESTION_OPENED", hostId, { sessionId, questionId: decision.openedQuestionId });
      if (decision.roundEnded) await recordEvent(tx, "QUESTION_ANSWERED", hostId, { sessionId, questionId: session.currentQuestionId });
      if (decision.usedPower) await recordEvent(tx, "POWERUP_USED", hostId, { sessionId, powerSlug: command.type === "USE_POWERUP" ? command.slug : undefined });
      if (decision.openedQuestionId) {
        await tx.gameRound.create({ data: { sessionId, number: session.currentRoundNumber + 1 } });
        await tx.sessionQuestion.create({ data: { sessionId, questionId: decision.openedQuestionId } });
        await tx.questionHistory.upsert({ where: { userId_questionId: { userId: hostId, questionId: decision.openedQuestionId } },
          create: { userId: hostId, questionId: decision.openedQuestionId },
          update: { lastPlayedAt: new Date(), playCount: { increment: 1 } } });
      }
      if (decision.roundEnded) await tx.gameRound.update({ where: { sessionId_number: { sessionId, number: session.currentRoundNumber } }, data: { endedAt: new Date() } });
      if (decision.roundReopened) await tx.gameRound.update({ where: { sessionId_number: { sessionId, number: session.currentRoundNumber } }, data: { endedAt: null } });
      if (decision.score) {
        await tx.team.update({ where: { id: decision.score.teamId, sessionId }, data: { score: { increment: decision.score.delta } } });
        await tx.scoreEvent.create({ data: { sessionId, teamId: decision.score.teamId, roundId: (await tx.gameRound.findUnique({
          where: { sessionId_number: { sessionId, number: session.currentRoundNumber } }, select: { id: true } }))?.id,
          delta: decision.score.delta, reason: decision.score.reason, commandKey: `${sessionId}:${key}` } });
      }
      if (decision.usedPower && availablePower) {
        await tx.sessionPowerUp.update({ where: { id: availablePower.id }, data: { remaining: { decrement: 1 }, usedAt: new Date() } });
      }
      if (decision.refundedPower) {
        await tx.sessionPowerUp.updateMany({ where: { sessionId, teamId: decision.refundedPower.teamId,
          powerUp: { slug: decision.refundedPower.slug } }, data: { remaining: { increment: 1 } } });
      }
      return false;
    });
    return { session: await getBoardSession(hostId, sessionId), duplicate };
  } catch (error) {
    const code = error instanceof GameRuleError ? error.code : typeof error === "object" && error && "code" in error ? error.code : null;
    if (code !== "STALE_GAME_STATE" && code !== "P2002" && code !== "P2034") throw error;
    // A competing transaction can reject before the winning receipt is visible. Check
    // the committed key after rollback, including optimistic version conflicts.
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await db().gameCommand.findUnique({ where: { sessionId_key: { sessionId, key } } });
      if (existing) {
        if (existing.payloadHash !== payloadHash) throw new GameRuleError("معرّف الأمر مستخدم لإجراء مختلف", 409, "COMMAND_KEY_REUSED");
        return { session: await getBoardSession(hostId, sessionId), duplicate: true };
      }
      if (code === "STALE_GAME_STATE") break;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
    throw new GameRuleError("تغيرت المباراة في نافذة أخرى. حدّث الصفحة", 409, "STALE_GAME_STATE");
  }
}
