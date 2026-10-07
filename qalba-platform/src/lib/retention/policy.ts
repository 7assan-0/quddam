import { createHash } from "node:crypto";

export const RETENTION = Object.freeze({ authDays: 30, resetDays: 7, accessDays: 30, privateVoteDays: 90, analyticsDays: 90, abuseHours: 48 });
export const DEFAULT_RETENTION_BATCH = 100;
export const MAX_RETENTION_BATCH = 500;
export const RETENTION_KINDS = ["AuthSession", "PasswordReset", "AuthAttempt", "DisplayAccess", "ForbiddenClueAccess", "LightningBuzzerAccess", "OrderingControllerAccess", "SocialParticipant", "BluffParticipant", "CourtParticipant", "RoomParticipant", "SocialVote", "CourtRoundVote", "AnalyticsEvent"] as const;
export type RetentionKind = typeof RETENTION_KINDS[number];
export type RetentionCursor = { eligibleAt: string; kind: RetentionKind; id: string };
export function retentionCutoffs(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid retention clock");
  const days = (n: number) => new Date(now.getTime() - n * 86400_000);
  return { auth: days(RETENTION.authDays), reset: days(RETENTION.resetDays), access: days(RETENTION.accessDays), privateVote: days(RETENTION.privateVoteDays), analytics: days(RETENTION.analyticsDays), abuse: new Date(now.getTime() - RETENTION.abuseHours * 3600_000) };
}
export function retentionBatchSize(size = DEFAULT_RETENTION_BATCH) {
  if (!Number.isInteger(size) || size < 1 || size > MAX_RETENTION_BATCH) throw new Error("Retention batch must be between 1 and 500");
  return size;
}
export function decodeRetentionCursor(cursor?: string): RetentionCursor | null {
  if (!cursor) return null;
  try {
    if (cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as RetentionCursor;
    if (!RETENTION_KINDS.includes(v.kind) || typeof v.id !== "string" || !v.id.length || v.id.length > 200 || new Date(v.eligibleAt).toISOString() !== v.eligibleAt) throw new Error();
    return { eligibleAt: v.eligibleAt, kind: v.kind, id: v.id };
  } catch { throw new Error("Invalid retention cursor"); }
}
export const encodeRetentionCursor = (value: RetentionCursor) => Buffer.from(JSON.stringify(value)).toString("base64url");
/** SHA-256 token hashes are hex. This unique non-hex marker cannot match
 * tokenHash(anyToken), and retains neither the credential nor its hash. */
export function retiredCredential(kind: RetentionKind, id: string) {
  return "retired:" + createHash("sha256").update(JSON.stringify([kind, id])).digest("hex").slice(0, 56);
}
/** Only aggregate counts survive, never voter/choice links. */
export function historicalSocialVoteCount(liveCount: number, summary: unknown, ballot: number) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return liveCount;
  const count = (summary as Record<string, unknown>)[String(ballot)];
  return liveCount + (Number.isSafeInteger(count) && Number(count) >= 0 ? Number(count) : 0);
}
