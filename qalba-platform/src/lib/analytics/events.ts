import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { runRetention } from "@/lib/retention/service";

export const eventNames = ["USER_REGISTERED", "GAME_CREATED", "GAME_STARTED", "GAME_COMPLETED", "QUESTION_OPENED", "QUESTION_ANSWERED", "POWERUP_USED", "PURCHASE_STARTED", "PURCHASE_COMPLETED", "PURCHASE_FAILED", "PURCHASE_CANCELED", "PURCHASE_EXPIRED", "PURCHASE_VOIDED", "ROOM_CREATED", "ROOM_JOINED", "BLUFF_GAME_STARTED", "BLUFF_ROUND_STARTED", "BLUFF_SUBMISSION_RECEIVED", "BLUFF_VOTING_STARTED", "BLUFF_VOTE_RECEIVED", "BLUFF_REVEALED", "BLUFF_ROUND_COMPLETED", "BLUFF_GAME_COMPLETED", "RANKED_GAME_STARTED", "RANKED_ROUND_STARTED", "RANKED_GUESS_CORRECT", "RANKED_GUESS_WRONG", "RANKED_ENTRY_REVEALED", "RANKED_TURN_CHANGED", "RANKED_GAME_PAUSED", "RANKED_GAME_RESUMED", "RANKED_ROUND_COMPLETED", "RANKED_GAME_COMPLETED", "RANKED_UNDO_AUDITED", "ORDER_GAME_STARTED", "ORDER_ROUND_STARTED", "ORDER_TEAM_PROGRESS", "ORDER_TEAM_SUBMITTED", "ORDER_TIMER_EXPIRED", "ORDER_REVEAL_STARTED", "ORDER_ROUND_COMPLETED", "ORDER_GAME_PAUSED", "ORDER_GAME_RESUMED", "ORDER_GAME_COMPLETED", "ORDER_TEAM_REOPENED", "ORDER_RESULT_VOIDED", "ORDER_GAME_ENDED", "ORDER_GAME_ABANDONED", "ORDER_FINAL_RESULTS", "LIGHTNING_GAME_STARTED", "LIGHTNING_QUESTION_READY", "LIGHTNING_BUZZ_OPENED", "LIGHTNING_BUZZ_LOCKED", "LIGHTNING_ANSWER_TIMER_STARTED", "LIGHTNING_ANSWER_CORRECT", "LIGHTNING_ANSWER_WRONG", "LIGHTNING_STEAL_STARTED", "LIGHTNING_STEAL_CORRECT", "LIGHTNING_STEAL_WRONG", "LIGHTNING_QUESTION_COMPLETED", "LIGHTNING_GAME_PAUSED", "LIGHTNING_GAME_RESUMED", "LIGHTNING_GAME_COMPLETED", "LIGHTNING_UNDO_AUDITED", "LIGHTNING_SCORE_VOIDED", "COURT_GAME_STARTED", "COURT_ROUND_STARTED", "COURT_PREPARATION_STARTED", "COURT_ARGUMENT_STARTED", "COURT_VOTING_STARTED", "COURT_VOTE_RECEIVED", "COURT_VERDICT_REVEALED", "COURT_ROUND_COMPLETED", "COURT_GAME_COMPLETED", "COURT_GAME_PAUSED", "COURT_GAME_RESUMED", "COURT_RESULT_VOIDED", "COURT_GAME_ABANDONED", "COURT_PHASE_UNDONE", "COURT_GAME_ENDED", "COURT_FINAL_RESULTS"] as const;
export type EventName = typeof eventNames[number];
const allowed = new Set(["gameSlug", "gameTypeId", "sessionId", "questionId", "categoryId", "powerSlug", "productId", "purchaseId", "roomId"]);
/** Only internal identifiers and controlled slugs are recorded; never player names, responses, payment details or IPs. */
export function cleanProperties(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter((entry): entry is [string, string] => allowed.has(entry[0]) && typeof entry[1] === "string" && entry[1].length <= 100)) as Record<string, string>;
}
export function recordEvent(tx: Prisma.TransactionClient, name: EventName, userId: string | null, properties: Record<string, unknown> = {}) {
  return tx.analyticsEvent.create({ data: { name, userId, properties: cleanProperties(properties) } });
}
export async function pruneAnalytics(retentionDays = 90) {
  if (!Number.isInteger(retentionDays) || retentionDays < 30 || retentionDays > 365) throw new Error("Invalid retention period");
  // The existing helper/cron now shares bounded cleanup and financial exclusions.
  const result = await runRetention({ analyticsDays: retentionDays, kinds: ["AnalyticsEvent"], batchSize: 500 }, db());
  if (result.failed) throw new Error("Analytics retention batch failed");
  return { count: result.deleted };
}
