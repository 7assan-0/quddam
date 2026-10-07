import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { consumePublicAuthAttempt } from "@/lib/auth/abuse";

export async function consumeAuthAttempt(email: string, action: string, limit = 8, request?: Request): Promise<boolean> {
  if (request) {
    if (!["register", "login", "admin-login", "forgot", "reset"].includes(action)) throw new Error("Unknown public authentication action");
    return consumePublicAuthAttempt(request, email, action as "register" | "login" | "admin-login" | "forgot" | "reset");
  }
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 24) throw new Error("AUTH_RATE_LIMIT_SECRET must be configured");
  const key = createHmac("sha256", secret).update(`${action}:${email}`).digest("hex");
  const now = new Date();
  const windowStart = new Date(now.getTime() - 3600_000);
  const rows = await db().$queryRaw<Array<{ count: number }>>`
    INSERT INTO "AuthAttempt" ("key", "count", "windowStart")
    VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AuthAttempt"."windowStart" < ${windowStart} THEN 1 ELSE "AuthAttempt"."count" + 1 END,
      "windowStart" = CASE WHEN "AuthAttempt"."windowStart" < ${windowStart} THEN ${now} ELSE "AuthAttempt"."windowStart" END
    RETURNING "count"
  `;
  return rows[0].count <= limit;
}
