import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { newToken, tokenHash } from "./crypto";

export const SESSION_COOKIE = "qalba_session";
const SESSION_DAYS = 14;

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db().authSession.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentAuthSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db().authSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, createdAt: true, suspendedAt: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.suspendedAt) return null;
  return { sessionId: session.id, expiresAt: session.expiresAt, user: session.user };
}

export async function currentUser() {
  return (await currentAuthSession())?.user ?? null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function revokeCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await db().authSession.updateMany({ where: { tokenHash: tokenHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  await clearSessionCookie();
}
