import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newToken, tokenHash } from "@/lib/auth/crypto";
import { forgotSchema } from "@/lib/auth/validation";
import { consumeAuthAttempt } from "@/lib/auth/rate-limit";
import { mailConfigured, sendResetMail } from "@/lib/auth/mail";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  if (!mailConfigured()) return NextResponse.json({ error: "استعادة كلمة المرور غير مهيأة حاليًا. تواصل مع المسؤول." }, { status: 503 });
  try {
    const { email } = await parseJson(request, forgotSchema);
    if (!(await consumeAuthAttempt(email, "forgot", 8, request))) return NextResponse.json({ ok: true });
    const user = await db().user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const token = newToken();
      const reset = await db().passwordReset.create({
        data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 30 * 60_000) },
      });
      try { await sendResetMail(email, token); }
      catch (error) {
        await db().passwordReset.delete({ where: { id: reset.id } });
        throw error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
