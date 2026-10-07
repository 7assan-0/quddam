import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { loginSchema } from "@/lib/auth/validation";
import { consumeAuthAttempt } from "@/lib/auth/rate-limit";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const input = await parseJson(request, loginSchema);
    if (!(await consumeAuthAttempt(input.email, "login", 8, request))) return NextResponse.json({ error: "طلبات كثيرة. حاول لاحقًا." }, { status: 429 });
    const user = await db().user.findUnique({ where: { email: input.email } });
    if (user?.role === "ADMIN" && !(await consumeAuthAttempt(input.email, "admin-login", 8, request))) return NextResponse.json({ error: "طلبات كثيرة. حاول لاحقًا." }, { status: 429 });
    if (!user?.passwordHash) await hashPassword(input.password); // similar work for unknown accounts
    const valid = user?.passwordHash ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!valid || !user) return NextResponse.json({ error: "البريد أو كلمة المرور غير صحيحة" }, { status: 401 });
    if (user.suspendedAt) return NextResponse.json({ error: "هذا الحساب موقوف. تواصل مع إدارة المنصة" }, { status: 403 });
    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
