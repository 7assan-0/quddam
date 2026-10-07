import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, tokenHash } from "@/lib/auth/crypto";
import { resetSchema } from "@/lib/auth/validation";
import { consumeAuthAttempt } from "@/lib/auth/rate-limit";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const input = await parseJson(request, resetSchema);
    if (!(await consumeAuthAttempt(input.token, "reset", 8, request))) return NextResponse.json({ error: "طلبات كثيرة. حاول لاحقًا." }, { status: 429 });
    const hash = tokenHash(input.token);
    const passwordHash = await hashPassword(input.password);
    const updated = await db().$transaction(async (tx) => {
      const used = await tx.passwordReset.updateMany({ where: { tokenHash: hash, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (used.count !== 1) return false;
      const reset = await tx.passwordReset.findUniqueOrThrow({ where: { tokenHash: hash } });
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.authSession.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return true;
    });
    if (!updated) return NextResponse.json({ error: "الرابط غير صالح أو انتهت صلاحيته" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
