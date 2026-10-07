import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Action = "register" | "login" | "admin-login" | "forgot" | "reset";
type Limit = { scope: "email" | "email-client" | "client" | "global"; count: number; milliseconds: number };
const minute = 60_000, hour = 60 * minute;

/** Fixed windows anchored at first admitted attempt; rejected traffic never extends them. */
export const AUTH_ABUSE_LIMITS: Record<Action, readonly Limit[]> = {
  register: [
    { scope: "email", count: 8, milliseconds: hour },
    { scope: "client", count: 12, milliseconds: minute }, { scope: "client", count: 60, milliseconds: hour },
    { scope: "global", count: 60, milliseconds: minute }, { scope: "global", count: 600, milliseconds: hour },
    { scope: "global", count: 3000, milliseconds: 24 * hour },
  ],
  login: [
    { scope: "email-client", count: 8, milliseconds: 15 * minute }, { scope: "email-client", count: 30, milliseconds: hour },
    { scope: "client", count: 60, milliseconds: minute }, { scope: "client", count: 300, milliseconds: hour },
    { scope: "global", count: 120, milliseconds: minute }, { scope: "global", count: 3000, milliseconds: hour },
  ],
  "admin-login": [
    { scope: "email-client", count: 5, milliseconds: 15 * minute }, { scope: "email-client", count: 10, milliseconds: hour },
    { scope: "client", count: 20, milliseconds: minute }, { scope: "client", count: 100, milliseconds: hour },
    { scope: "global", count: 60, milliseconds: minute }, { scope: "global", count: 600, milliseconds: hour },
  ],
  forgot: [
    { scope: "email-client", count: 3, milliseconds: 15 * minute }, { scope: "email-client", count: 10, milliseconds: hour },
    { scope: "client", count: 20, milliseconds: minute }, { scope: "client", count: 100, milliseconds: hour },
    { scope: "global", count: 60, milliseconds: minute }, { scope: "global", count: 600, milliseconds: hour },
  ],
  reset: [
    { scope: "email-client", count: 5, milliseconds: 15 * minute }, { scope: "email-client", count: 10, milliseconds: hour },
    { scope: "client", count: 20, milliseconds: minute }, { scope: "client", count: 100, milliseconds: hour },
    { scope: "global", count: 60, milliseconds: minute }, { scope: "global", count: 600, milliseconds: hour },
  ],
};

/** Only an explicitly trusted, ingress-overwritten single-IP header is accepted. */
export function authClientIdentity(request: Request): string {
  if (process.env.AUTH_TRUST_PROXY !== "true") return "unknown";
  const header = process.env.AUTH_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (!header || !/^[a-z0-9-]+$/.test(header)) throw new Error("AUTH_CLIENT_IP_HEADER must be configured for the trusted ingress");
  const address = request.headers.get(header)?.trim() ?? "";
  if (/[%,\s]/.test(address)) return "unknown";
  const family = isIP(address);
  if (family === 4) return `ipv4:${address}`;
  if (family !== 6) return "unknown"; // Missing, multiple, malformed, ports and zone IDs fail closed.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split("::");
  const before = left ? left.split(":") : [], after = right ? right.split(":") : [];
  const groups = canonical.includes("::") ? [...before, ...Array<string>(8 - before.length - after.length).fill("0"), ...after] : before;
  const values = groups.map(value => parseInt(value, 16));
  // IPv4-mapped spellings share the IPv4 bucket; IPv6 temporary-address rotation shares /64.
  if (values.slice(0, 5).every(value => value === 0) && values[5] === 0xffff) {
    return `ipv4:${values[6] >> 8}.${values[6] & 255}.${values[7] >> 8}.${values[7] & 255}`;
  }
  return `ipv6:${values.slice(0, 4).map(value => value.toString(16)).join(":")}/64`;
}

export function authBudget(request: Request, identity: string, action: Action) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 24) throw new Error("AUTH_RATE_LIMIT_SECRET must be configured");
  const client = authClientIdentity(request), email = identity.trim().toLowerCase();
  return AUTH_ABUSE_LIMITS[action].map(limit => {
    const subject = limit.scope === "global" ? "all" : limit.scope === "client" ? client : limit.scope === "email" ? email : [email, client];
    const key = createHmac("sha256", secret).update(JSON.stringify(["auth-abuse-v1", action, limit.scope, limit.milliseconds, subject])).digest("hex");
    return { ...limit, key };
  }).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

export const AUTH_ATTEMPT_RETENTION_MS = 48 * hour;
/** One indexed, bounded batch. Also run the dedicated retention script daily during idle periods. */
export async function pruneAuthAttempts(client: Prisma.TransactionClient | PrismaClient = db(), now = new Date()) {
  const before = new Date(now.getTime() - AUTH_ATTEMPT_RETENTION_MS);
  return client.$executeRaw`
    DELETE FROM "AuthAttempt" WHERE "key" IN (
      SELECT "key" FROM "AuthAttempt" WHERE "windowStart" < ${before}
      AND ("blockedUntil" IS NULL OR "blockedUntil" < ${now})
      ORDER BY "windowStart", "key" LIMIT 500 FOR UPDATE SKIP LOCKED
    )
  `;
}

class BudgetExhausted extends Error {}

/** All counters share PostgreSQL; one short transaction atomically admits all layers or none. */
export async function consumePublicAuthAttempt(request: Request, identity: string, action: Action, now = new Date()): Promise<boolean> {
  const budget = authBudget(request, identity, action);
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
        if (rows.length !== 1) throw new BudgetExhausted();
      }
    }, { maxWait: 10_000, timeout: 10_000 });
    return true;
  } catch (error) { if (error instanceof BudgetExhausted) return false; throw error; }
}
