import { newToken, tokenHash } from "@/lib/auth/crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { GameRuleError } from "./module";
import { getBoardSession } from "./service";
import { DISPLAY_ACTIVE_LINK_LIMIT, DISPLAY_LINKS_PER_WINDOW, DISPLAY_LINK_WINDOW_MS,
  DISPLAY_TOKEN_TTL_MS, displayAccessValid, displayWindowEndsAt } from "./display-policy";

export { displayAccessValid, DISPLAY_COMPLETED_GRACE_MS } from "./display-policy";

async function lockDisplaySession(tx: Prisma.TransactionClient, hostId: string, sessionId: string) {
  await tx.$queryRaw`SELECT id FROM "GameSession" WHERE id = ${sessionId} FOR UPDATE`;
  const session = await tx.gameSession.findUnique({ where: { id: sessionId }, include: { gameType: { select: { slug: true } } } });
  if (!session || session.gameType.slug !== "category-board") throw new GameRuleError("المباراة غير موجودة", 404);
  if (session.hostId !== hostId) throw new GameRuleError("غير مصرح لك بإدارة هذه المباراة", 403);
  return session;
}

export async function createDisplayAccess(hostId: string, sessionId: string) {
  const token = newToken();
  const access = await db().$transaction(async (tx) => {
    const session = await lockDisplaySession(tx, hostId, sessionId);
    // Count/create/revoke share the persisted session lock, including a fresh clock after waiting.
    const now = new Date();
    const windowEndsAt = displayWindowEndsAt(session.endedAt, now);
    if (session.endedAt && !windowEndsAt) throw new GameRuleError("انتهت فترة عرض المباراة المكتملة", 410, "DISPLAY_WINDOW_CLOSED");
    const expiresAt = new Date(Math.min(now.getTime() + DISPLAY_TOKEN_TTL_MS, windowEndsAt?.getTime() ?? Infinity));
    await tx.displayAccess.deleteMany({ where: { sessionId, expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
    const [recent, active] = await Promise.all([
      tx.displayAccess.count({ where: { sessionId, createdAt: { gte: new Date(now.getTime() - DISPLAY_LINK_WINDOW_MS) } } }),
      tx.displayAccess.count({ where: { sessionId, revokedAt: null, expiresAt: { gt: now } } }),
    ]);
    if (recent >= DISPLAY_LINKS_PER_WINDOW || active >= DISPLAY_ACTIVE_LINK_LIMIT) {
      throw new GameRuleError("وصلت إلى حد روابط العرض لهذه المباراة. ألغِ الروابط النشطة أو حاول لاحقًا", 429, "DISPLAY_LINK_RATE_LIMIT");
    }
    return tx.displayAccess.create({ data: { sessionId, tokenHash: tokenHash(token), expiresAt } });
  });
  return { token, id: access.id, expiresAt: access.expiresAt };
}

export async function revokeDisplayAccess(hostId: string, sessionId: string) {
  await db().$transaction(async tx => {
    await lockDisplaySession(tx, hostId, sessionId);
    await tx.displayAccess.updateMany({ where: { sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  });
}

export async function getBoardDisplaySession(sessionId: string, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new GameRuleError("رابط العرض غير صالح", 403, "DISPLAY_ACCESS_DENIED");
  const access = await db().displayAccess.findUnique({ where: { tokenHash: tokenHash(token) },
    include: { session: { select: { id: true, hostId: true, endedAt: true } } } });
  if (!access || access.sessionId !== sessionId || !displayAccessValid(access, access.session, new Date())) {
    throw new GameRuleError("انتهت صلاحية رابط العرض أو أُلغي", 403, "DISPLAY_ACCESS_DENIED");
  }
  return getBoardSession(access.session.hostId, sessionId);
}
