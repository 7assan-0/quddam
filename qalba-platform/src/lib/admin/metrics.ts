import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { LETTER_WEIGHTS } from "@/lib/games/letter-network/module";
import { saudiDayStart } from "./metric-policy";
export { saudiDayStart } from "./metric-policy";

/** Authored launch banks only; a legacy Party Question is not a dedicated-bank item. */
export function contentMetrics(tx: Prisma.TransactionClient) {
  return tx.$queryRaw<Array<{ total: bigint; published: bigint; eligible: bigint }>>`
    WITH bank AS (
      SELECT q.status, c.active, (q.language='ar') AS language, (q.type IN ('TEXT','MULTIPLE_CHOICE','TRUE_FALSE','IMAGE') AND q."pointValue" IN (200,400,600)) AS supported
        FROM "Question" q JOIN "GameType" g ON g.id=q."gameTypeId" JOIN "Category" c ON c.id=q."categoryId" WHERE g.slug='category-board'
      UNION ALL SELECT q.status,c.active,q.language='ar',true FROM "SecretWord" q JOIN "Category" c ON c.id=q."categoryId"
      UNION ALL SELECT q.status,c.active,true,q.letter = ANY(${Object.keys(LETTER_WEIGHTS)}::text[]) FROM "LetterQuestion" q JOIN "Category" c ON c.id=q."categoryId"
      UNION ALL SELECT q.status,c.active,q.locale='ar-SA',true FROM "SurveyQuestion" q JOIN "Category" c ON c.id=q."categoryId"
      UNION ALL SELECT q.status,c.active,q.locale='ar-SA',true FROM "ForbiddenWordCard" q JOIN "Category" c ON c.id=q."categoryId"
      UNION ALL SELECT q.status,c.active,q.locale='ar-SA',true FROM "BluffQuestion" q JOIN "Category" c ON c.id=q."categoryId"
      UNION ALL SELECT q.status,c.active,q.locale='ar-SA',true FROM "RankedListQuestion" q JOIN "Category" c ON c.id=q."categoryId"
      UNION ALL SELECT q.status,c.active,q.locale='ar-SA',true FROM "LightningQuestion" q JOIN "Category" c ON c.id=q."categoryId"
      UNION ALL SELECT q.status,c.active,q.locale='ar-SA',true FROM "OrderingQuestion" q JOIN "Category" c ON c.id=q."categoryId"
      UNION ALL SELECT q.status,c.active,q.locale='ar-SA',true FROM "CourtCase" q JOIN "Category" c ON c.id=q."categoryId"
    ) SELECT count(*)::bigint AS total, count(*) FILTER (WHERE status='PUBLISHED')::bigint AS published,
      count(*) FILTER (WHERE status='PUBLISHED' AND active AND language AND supported)::bigint AS eligible FROM bank`;
}

/** Allocations/snapshots, not a claimed number of questions shown or scored. */
export async function usageMetrics(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ title: string; total: bigint }>>`
    WITH uses AS (
      SELECT q."categoryId" FROM "SessionQuestion" u JOIN "Question" q ON q.id=u."questionId" JOIN "GameType" g ON g.id=q."gameTypeId" WHERE g.slug='category-board'
      UNION ALL SELECT q."categoryId" FROM "SocialRound" u JOIN "SecretWord" q ON q.id=u."secretWordId"
      UNION ALL SELECT q."categoryId" FROM "LetterQuestionUse" u JOIN "LetterQuestion" q ON q.id=u."questionId"
      UNION ALL SELECT q."categoryId" FROM "SurveyQuestionUse" u JOIN "SurveyQuestion" q ON q.id=u."questionId"
      UNION ALL SELECT q."categoryId" FROM "ForbiddenWordCardUse" u JOIN "ForbiddenWordCard" q ON q.id=u."cardId"
      UNION ALL SELECT q."categoryId" FROM "BluffRound" u JOIN "BluffQuestion" q ON q.id=u."questionId"
      UNION ALL SELECT q."categoryId" FROM "RankedListUse" u JOIN "RankedListQuestion" q ON q.id=u."questionId"
      UNION ALL SELECT q."categoryId" FROM "LightningQuestionUse" u JOIN "LightningQuestion" q ON q.id=u."questionId"
      UNION ALL SELECT q."categoryId" FROM "OrderingQuestionUse" u JOIN "OrderingQuestion" q ON q.id=u."questionId"
      UNION ALL SELECT q."categoryId" FROM "CourtRound" u JOIN "CourtCase" q ON q.id=u."caseId"
    ) SELECT c.title, count(*)::bigint AS total FROM uses u JOIN "Category" c ON c.id=u."categoryId" GROUP BY c.id,c.title ORDER BY total DESC,c.id`;
  return { usage: rows.reduce((sum, r) => sum + Number(r.total), 0), popularCategories: rows.slice(0, 5).map(r => ({ title: r.title, total: Number(r.total) })) };
}

export async function adminMetrics(now = new Date()) {
  return db().$transaction(async tx => {
    const [users, active, games, today, revenue, refunds, categories, content, reports, usage, popularGames] = await Promise.all([
      tx.user.count(), tx.authSession.groupBy({ by: ["userId"], where: { revokedAt: null, expiresAt: { gt: now }, user: { suspendedAt: null } } }),
      tx.gameSession.count(), tx.gameSession.count({ where: { createdAt: { gte: saudiDayStart(now), lte: now } } }),
      tx.purchase.aggregate({ where: { OR: [{ status: "PAID" }, { status: "REFUNDED", paidAt: { not: null } }] }, _sum: { amountHalalas: true } }),
      tx.purchaseRefund.aggregate({ _sum: { amountHalalas: true } }), tx.category.count(), contentMetrics(tx),
      tx.questionReport.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }), usageMetrics(tx),
      tx.$queryRaw<Array<{ title: string; total: bigint }>>`SELECT g.title, count(*)::bigint AS total FROM "GameSession" s JOIN "GameType" g ON g.id=s."gameTypeId" GROUP BY g.id,g.title ORDER BY total DESC,g.id LIMIT 5`,
    ]);
    return { users, active: active.length, games, today, revenueHalalas: revenue._sum.amountHalalas ?? 0, refundHalalas: refunds._sum.amountHalalas ?? 0,
      categories, questions: Number(content[0].total), published: Number(content[0].published), eligible: Number(content[0].eligible), reports, ...usage,
      popularGames: popularGames.map(item => ({ title: item.title, total: Number(item.total) })) };
  }, { isolationLevel: "RepeatableRead" });
}
