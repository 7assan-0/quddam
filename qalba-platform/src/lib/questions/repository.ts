import { db } from "@/lib/db";
import { selectQuestion } from "./selection";
import type { Difficulty } from "@/generated/prisma/client";

type Query = { userId: string; gameTypeId: string; categoryId: string; difficulty: Difficulty; usedQuestionIds: string[] };

export async function nextQuestionForAccount(input: Query) {
  const [candidates, history] = await Promise.all([
    db().question.findMany({
      where: {
        gameTypeId: input.gameTypeId, categoryId: input.categoryId,
        difficulty: input.difficulty, status: "PUBLISHED", id: { notIn: input.usedQuestionIds },
      },
      select: { id: true, categoryId: true, difficulty: true },
    }),
    db().questionHistory.findMany({ where: { userId: input.userId }, select: { questionId: true, lastPlayedAt: true } }),
  ]);
  const selected = selectQuestion(candidates, history, new Set(input.usedQuestionIds));
  return selected ? db().question.findUnique({ where: { id: selected.id } }) : null;
}

/** Called by a future authoritative game command only after the question is opened. */
export async function recordQuestionOpened(userId: string, sessionId: string, questionId: string) {
  await db().$transaction(async (tx) => {
    await tx.sessionQuestion.create({ data: { sessionId, questionId } });
    await tx.questionHistory.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: { userId, questionId, playCount: 1 },
      update: { lastPlayedAt: new Date(), playCount: { increment: 1 } },
    });
  });
}
