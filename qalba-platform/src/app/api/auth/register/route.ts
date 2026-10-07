import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/crypto";
import { registerSchema } from "@/lib/auth/validation";
import { consumeAuthAttempt } from "@/lib/auth/rate-limit";
import { CreditError, ensureWelcomeCredits } from "@/lib/billing/credits";
import { recordEvent } from "@/lib/analytics/events";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const input = await parseJson(request, registerSchema);
    if (!(await consumeAuthAttempt(input.email, "register", 8, request))) return NextResponse.json({ error: "طلبات كثيرة. حاول لاحقًا." }, { status: 429 });
    const existing = await db().user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "البريد مستخدم بالفعل" }, { status: 409 });
    const passwordHash = await hashPassword(input.password);
    const user = await db().$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name: input.name, email: input.email, passwordHash,
        wallet: { create: { balance: 0 } } }, select: { id: true } });
      await ensureWelcomeCredits(tx, created.id);
      await recordEvent(tx, "USER_REGISTERED", created.id);
      return created;
    });
    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof CreditError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "البريد مستخدم بالفعل" }, { status: 409 });
    }
    return errorResponse(error);
  }
}
