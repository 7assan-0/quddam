import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { publicWelcomeCreditsEnabled } from "@/lib/auth/welcome-policy";

const welcomeConfig = z.object({ count: z.number().int().min(0).max(20) });
export class CreditError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

/** One entitlement per account, including accounts created before credits launched. */
export async function ensureWelcomeCredits(tx: Prisma.TransactionClient, userId: string) {
  const setting = await tx.featureFlag.findUnique({ where: { key: "welcome-credits" } });
  if (!setting) throw new CreditError("إعداد رصيد البداية غير موجود. شغّل تجهيز البيانات أولًا", 503);
  const parsed = welcomeConfig.safeParse(setting.config);
  if (!parsed.success) throw new CreditError("إعداد رصيد البداية غير صالح", 503);
  const amount = setting.enabled && publicWelcomeCreditsEnabled() ? parsed.data.count : 0;
  // An emulated upsert can race when an older eligible account has no wallet yet.
  await tx.creditWallet.createMany({ data: [{ userId, balance: 0 }], skipDuplicates: true });
  const inserted = await tx.gameCredit.createMany({ data: [{ id: randomUUID(), userId, delta: amount,
    reason: "رصيد البداية", idempotencyKey: `welcome:${userId}` }], skipDuplicates: true });
  if (inserted.count === 1 && amount > 0) {
    await tx.creditWallet.update({ where: { userId }, data: { balance: { increment: amount } } });
  }
  return tx.creditWallet.findUniqueOrThrow({ where: { userId } });
}

export async function walletForAccount(userId: string) {
  return db().$transaction((tx) => ensureWelcomeCredits(tx, userId));
}

/** Caller holds the session command transaction and has already validated START. */
export async function consumeGameCredit(tx: Prisma.TransactionClient, userId: string, sessionId: string, alreadyConsumed: boolean) {
  if (alreadyConsumed) return false;
  await ensureWelcomeCredits(tx, userId);
  const key = `game-start:${sessionId}`;
  if (await tx.gameCredit.findUnique({ where: { idempotencyKey: key } })) return false;
  const debit = await tx.creditWallet.updateMany({ where: { userId, balance: { gte: 1 } }, data: { balance: { decrement: 1 } } });
  if (debit.count !== 1) throw new CreditError("رصيد الألعاب غير كافٍ. اختر باقة من صفحة الأسعار", 402);
  await tx.gameCredit.create({ data: { userId, delta: -1, reason: "بدء مباراة", idempotencyKey: key } });
  return true;
}

export async function grantAdminCredits(adminId: string, email: string, amount: number, key: string) {
  return db().$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email }, select: { id: true, name: true } });
    if (!user) throw new CreditError("الحساب غير موجود", 404);
    await ensureWelcomeCredits(tx, user.id);
    const ledgerKey = `admin:${adminId}:${key}`;
    const existing = await tx.gameCredit.findUnique({ where: { idempotencyKey: ledgerKey } });
    if (existing && (existing.userId !== user.id || existing.delta !== amount)) throw new CreditError("مفتاح الطلب مستخدم لمنحة مختلفة", 409);
    const inserted = await tx.gameCredit.createMany({ data: [{ id: randomUUID(), userId: user.id, delta: amount,
      reason: "منحة المسؤول", idempotencyKey: ledgerKey }], skipDuplicates: true });
    if (inserted.count === 0 && !existing) {
      const prior = await tx.gameCredit.findUniqueOrThrow({ where: { idempotencyKey: ledgerKey } });
      if (prior.userId !== user.id || prior.delta !== amount) throw new CreditError("مفتاح الطلب مستخدم لمنحة مختلفة", 409);
    }
    if (inserted.count === 1) await tx.creditWallet.update({ where: { userId: user.id }, data: { balance: { increment: amount } } });
    const wallet = await tx.creditWallet.findUniqueOrThrow({ where: { userId: user.id } });
    return { name: user.name, balance: wallet.balance, duplicate: inserted.count === 0 };
  });
}

export async function setWelcomeCredits(count: number, enabled: boolean) {
  return db().featureFlag.upsert({ where: { key: "welcome-credits" },
    create: { key: "welcome-credits", enabled, config: { count } }, update: { enabled, config: { count } } });
}
