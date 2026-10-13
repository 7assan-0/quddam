import { createHmac } from "node:crypto";
import { authClientIdentity, pruneAuthAttempts } from "@/lib/auth/abuse";
import { db } from "@/lib/db";
import { normalizeCode } from "@/lib/rooms/service";

export type JoinKind = "board" | "social" | "court" | "bluff";
type Scope = "room-client" | "room" | "client" | "global";
type Limit = { scope: Scope; count: number; milliseconds: number };
const minute = 60_000, hour = 60 * minute;

// Every guest-join route shares the client and global layers. Values apply to
// attempts (including malformed bodies/reconnects), not successful roster writes.
export const JOIN_ADMISSION_LIMITS: readonly Limit[] = [
  { scope: "room-client", count: 12, milliseconds: minute },
  { scope: "room", count: 60, milliseconds: minute },
  { scope: "client", count: 30, milliseconds: minute },
  { scope: "client", count: 150, milliseconds: hour },
  { scope: "global", count: 300, milliseconds: minute },
  { scope: "global", count: 3000, milliseconds: hour },
];

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Invalid paths share one fixed subject per game, never attacker-chosen keys. */
export function joinAdmissionTarget(kind: JoinKind, value: string): string {
  if (kind === "board") {
    try { return normalizeCode(value); } catch { return "invalid"; }
  }
  return uuid.test(value) ? value.toLowerCase() : "invalid";
}

export function joinAdmissionBudget(request: Request, kind: JoinKind, rawTarget: string) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 24) throw new Error("AUTH_RATE_LIMIT_SECRET must be configured");
  // A raw X-Forwarded-For value is never used. Without a trusted, overwritten
  // single-IP ingress header, all clients share the conservative unknown bucket.
  const client = authClientIdentity(request);
  const room = `${kind}:${joinAdmissionTarget(kind, rawTarget)}`;
  return JOIN_ADMISSION_LIMITS.map(limit => {
    const subject = limit.scope === "global" ? "all" : limit.scope === "client" ? client
      : limit.scope === "room" ? room : [room, client];
    const key = createHmac("sha256", secret)
      .update(JSON.stringify(["guest-join-v1", limit.scope, limit.milliseconds, subject])).digest("hex");
    return { ...limit, key };
  }).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

class JoinBudgetExhausted extends Error {}

/** Shared PostgreSQL admission. All layers commit together; rejection rolls back
 * every provisional increment and does not extend an exhausted window. */
export async function consumeJoinAdmission(request: Request, kind: JoinKind, rawTarget: string, now = new Date()): Promise<boolean> {
  const budget = joinAdmissionBudget(request, kind, rawTarget);
  await pruneAuthAttempts(db(), now);
  try {
    await db().$transaction(async tx => {
      for (const limit of budget) {
        const start = new Date(now.getTime() - limit.milliseconds);
        const rows = await tx.$queryRaw<Array<{ count: number }>>`
          INSERT INTO "AuthAttempt" ("key", "count", "windowStart") VALUES (${limit.key}, 1, ${now})
          ON CONFLICT ("key") DO UPDATE SET
            "count" = CASE WHEN "AuthAttempt"."windowStart" <= ${start} THEN 1 ELSE "AuthAttempt"."count" + 1 END,
            "windowStart" = CASE WHEN "AuthAttempt"."windowStart" <= ${start} THEN ${now} ELSE "AuthAttempt"."windowStart" END
          WHERE "AuthAttempt"."windowStart" <= ${start} OR "AuthAttempt"."count" < ${limit.count}
          RETURNING "count"
        `;
        if (rows.length !== 1) throw new JoinBudgetExhausted();
      }
    }, { maxWait: 10_000, timeout: 10_000 });
    return true;
  } catch (error) {
    if (error instanceof JoinBudgetExhausted) return false;
    throw error;
  }
}
