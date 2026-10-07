import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { decodeRetentionCursor, encodeRetentionCursor, retiredCredential, retentionBatchSize, retentionCutoffs, RETENTION_KINDS, type RetentionKind } from "./policy";

type Candidate = { id: string; kind: RetentionKind; eligibleAt: Date; sessionId: string | null; roomId: string | null };
type Counts = { scanned: number; eligible: number; deleted: number; redacted: number; skipped: number; failed: number };
export type RetentionOptions = { dryRun?: boolean; batchSize?: number; cursor?: string; now?: Date; kinds?: readonly RetentionKind[]; analyticsDays?: number };
const credentialKinds = new Set<RetentionKind>(["SocialParticipant", "BluffParticipant", "CourtParticipant", "RoomParticipant"]);
// Fail conservatively for inconsistent/unknown legacy state: terminal status
// alone must never authorize cleanup of a persisted active phase.
const terminal = `s."status" IN ('COMPLETED','ABANDONED') AND s."endedAt" IS NOT NULL AND (s."state"->>'phase' IN ('COMPLETED','ABANDONED','DONE') OR s."state"->'completed'='true'::jsonb)`;
/** Fixed identifiers only; every date/ID/limit is bound. Returns metadata only. */
export function retentionEligibilitySql() {
  const invalid = (table: string, field: string, cutoff: string) => `SELECT a."id", '${table}'::text AS "kind", LEAST(a."expiresAt", COALESCE(a."${field}", a."expiresAt")) AS "eligibleAt", NULL::text AS "sessionId", NULL::text AS "roomId" FROM "${table}" a WHERE a."expiresAt" < ${cutoff} OR a."${field}" < ${cutoff}`;
  const accesses = ["DisplayAccess", "ForbiddenClueAccess", "LightningBuzzerAccess", "OrderingControllerAccess"].map(table => `SELECT a."id", '${table}'::text AS "kind", GREATEST(LEAST(a."expiresAt", COALESCE(a."revokedAt",a."expiresAt")), s."endedAt") AS "eligibleAt", a."sessionId", NULL::text AS "roomId" FROM "${table}" a JOIN "GameSession" s ON s."id"=a."sessionId" WHERE ${terminal} AND s."endedAt" < $3 AND (a."expiresAt" < $3 OR a."revokedAt" < $3)`);
  const participants = ["SocialParticipant", "BluffParticipant", "CourtParticipant"].map(table => `SELECT p."id", '${table}'::text AS "kind", GREATEST(r."expiresAt",s."endedAt") AS "eligibleAt", p."sessionId", r."id" AS "roomId" FROM "${table}" p JOIN "GameSession" s ON s."id"=p."sessionId" JOIN "Room" r ON r."sessionId"=s."id" WHERE ${terminal} AND s."endedAt" < $3 AND r."expiresAt" < $3 AND p."tokenHash" NOT LIKE 'retired:%'`);
  const votes = ["SocialVote", "CourtRoundVote"].map((table, i) => `SELECT v."id", '${table}'::text AS "kind", GREATEST(s."endedAt",r."expiresAt",v."createdAt") AS "eligibleAt", sr."sessionId", r."id" AS "roomId" FROM "${table}" v JOIN "${i ? "CourtRound" : "SocialRound"}" sr ON sr."id"=v."roundId" JOIN "GameSession" s ON s."id"=sr."sessionId" JOIN "Room" r ON r."sessionId"=s."id" WHERE ${terminal} AND s."endedAt" < $4 AND v."createdAt" < $4 AND r."expiresAt" < $3`);
  return [invalid("AuthSession", "revokedAt", "$1"), invalid("PasswordReset", "usedAt", "$2"),
    `SELECT a."key" AS "id", 'AuthAttempt'::text AS "kind", a."windowStart" AS "eligibleAt", NULL::text AS "sessionId", NULL::text AS "roomId" FROM "AuthAttempt" a WHERE a."windowStart" < $6 AND (a."blockedUntil" IS NULL OR a."blockedUntil" < $7)`,
    ...accesses, ...participants,
    `SELECT p."id", 'RoomParticipant'::text AS "kind", GREATEST(r."expiresAt",COALESCE(s."endedAt",r."expiresAt")) AS "eligibleAt", r."sessionId", r."id" AS "roomId" FROM "RoomParticipant" p JOIN "Room" r ON r."id"=p."roomId" LEFT JOIN "GameSession" s ON s."id"=r."sessionId" WHERE r."expiresAt" < $3 AND p."tokenHash" IS NOT NULL AND (r."sessionId" IS NULL OR (${terminal} AND s."endedAt" < $3))`,
    ...votes,
    `SELECT a."id", 'AnalyticsEvent'::text AS "kind", a."occurredAt" AS "eligibleAt", s."id" AS "sessionId", NULL::text AS "roomId" FROM "AnalyticsEvent" a LEFT JOIN "GameSession" s ON s."id"=a."properties"->>'sessionId' WHERE a."occurredAt" < $5 AND a."name" NOT LIKE 'PURCHASE_%' AND a."name" NOT LIKE 'PAYMENT_%' AND a."name" NOT LIKE 'REFUND_%' AND (s."id" IS NULL OR (${terminal} AND s."endedAt" < $5))`
  ].join(" UNION ALL ");
}
/** One bounded invocation. Scheduled runs restart from the oldest candidate
 * so skipped, failed and locked records remain eligible for a later run. */
export async function runRetention(options: RetentionOptions = {}, client: PrismaClient = db()) {
  const now = options.now ?? new Date(), cutoffs = retentionCutoffs(now), size = retentionBatchSize(options.batchSize), cursor = decodeRetentionCursor(options.cursor);
  if (options.analyticsDays !== undefined) {
    if (!Number.isInteger(options.analyticsDays) || options.analyticsDays < 30 || options.analyticsDays > 365) throw new Error("Invalid analytics retention period");
    cutoffs.analytics = new Date(now.getTime() - options.analyticsDays * 86400_000);
  }
  const kinds = options.kinds ? [...new Set(options.kinds)] : [...RETENTION_KINDS];
  if (kinds.some(kind => !RETENTION_KINDS.includes(kind))) throw new Error("Invalid retention kind");
  const values = [cutoffs.auth, cutoffs.reset, cutoffs.access, cutoffs.privateVote, cutoffs.analytics, cutoffs.abuse, now];
  const source = retentionEligibilitySql();
  const rows = await client.$queryRawUnsafe<Candidate[]>(`SELECT * FROM (${source}) c WHERE c."kind"=ANY($8::text[]) ${cursor ? 'AND (c."eligibleAt", c."kind" COLLATE "C", c."id" COLLATE "C") > ($10::timestamp, $11::text COLLATE "C", $12::text COLLATE "C")' : ''} ORDER BY c."eligibleAt",c."kind" COLLATE "C",c."id" COLLATE "C" LIMIT $9`, ...values, kinds, size + 1, ...(cursor ? [new Date(cursor.eligibleAt), cursor.kind, cursor.id] : []));
  const counts: Counts = { scanned: 0, eligible: 0, deleted: 0, redacted: 0, skipped: 0, failed: 0 };
  const byKind = Object.fromEntries(kinds.map(kind => [kind, { ...counts }])) as Partial<Record<RetentionKind, Counts>>;
  for (const c of rows.slice(0, size)) {
    const bucket = byKind[c.kind]!;
    counts.scanned++; bucket.scanned++;
    try {
      const action = await client.$transaction(async tx => {
        // Same order as game commands: session -> room -> child. Never wait
        // behind a live command or another worker; recheck AFTER locks.
        if (!options.dryRun) {
          if (c.sessionId && !await locked(tx, "GameSession", "id", c.sessionId)) return "skipped";
          if (c.roomId && !await locked(tx, "Room", "id", c.roomId)) return "skipped";
          if (!await locked(tx, c.kind, c.kind === "AuthAttempt" ? "key" : "id", c.id)) return "skipped";
        }
        const fresh = await tx.$queryRawUnsafe<Candidate[]>(`SELECT * FROM (${source}) c WHERE c."kind"=$8 AND c."id"=$9`, ...values, c.kind, c.id);
        if (!fresh.length || fresh[0].sessionId !== c.sessionId || fresh[0].roomId !== c.roomId) return "skipped";
        if (options.dryRun) return "eligible";
        return removeCandidate(tx, c);
      }, { maxWait: 2000, timeout: 5000 });
      if (action === "skipped") { counts.skipped++; bucket.skipped++; }
      else { counts.eligible++; bucket.eligible++; if (action !== "eligible") { counts[action]++; bucket[action]++; } }
    } catch {
      // Only aggregate failure counts: no error message, row ID or payload.
      // This transaction rolls back; earlier completed records stay committed.
      counts.failed++; bucket.failed++;
    }
  }
  const last = rows.slice(0, size).at(-1);
  return { dryRun: Boolean(options.dryRun), batchSize: size, ...counts, byKind, hasMore: rows.length > size,
    nextCursor: last ? encodeRetentionCursor({ eligibleAt: last.eligibleAt.toISOString(), kind: last.kind, id: last.id }) : null };
}
async function locked(tx: Prisma.TransactionClient, table: string, column: string, id: string) {
  const rows = await tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "${column}" AS "id" FROM "${table}" WHERE "${column}"=$1 FOR UPDATE SKIP LOCKED`, id);
  return rows.length === 1;
}
async function removeCandidate(tx: Prisma.TransactionClient, c: Candidate): Promise<"deleted" | "redacted"> {
  if (credentialKinds.has(c.kind)) {
    await tx.$executeRawUnsafe(`UPDATE "${c.kind}" SET "tokenHash"=$1 WHERE "id"=$2`, c.kind === "RoomParticipant" ? null : retiredCredential(c.kind, c.id), c.id);
    return "redacted";
  }
  if (c.kind === "SocialVote") {
    await tx.$executeRawUnsafe(`UPDATE "SocialRound" r SET "retainedVoteCounts"=jsonb_set(r."retainedVoteCounts", ARRAY[v."ballot"::text], to_jsonb(COALESCE((r."retainedVoteCounts"->>v."ballot"::text)::int,0)+1)) FROM "SocialVote" v WHERE v."id"=$1 AND r."id"=v."roundId"`, c.id);
  } else if (c.kind === "CourtRoundVote") {
    await tx.$executeRawUnsafe(`UPDATE "CourtRound" r SET "retainedVoteCount"=r."retainedVoteCount"+1 FROM "CourtRoundVote" v WHERE v."id"=$1 AND r."id"=v."roundId"`, c.id);
  }
  await tx.$executeRawUnsafe(`DELETE FROM "${c.kind}" WHERE "${c.kind === "AuthAttempt" ? "key" : "id"}"=$1`, c.id);
  return "deleted";
}
