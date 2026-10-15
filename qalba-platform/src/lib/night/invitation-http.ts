import { NextResponse } from "next/server";
import { InviteInputError, inviteCodePattern } from "./invitation";
import { nightErrorResponse, nightPrivateHeaders } from "./http";
export function invitationCode(code: string) {
  if (!inviteCodePattern.test(code)) throw new InviteInputError("الدعوة غير موجودة", 404);
  return code;
}
export function invitationCapability(value?: string) {
  return value && /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : undefined;
}
export function invitationCookieOptions(code: string, expiresAt: Date) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const,
    // This capability authorizes only one RSVP API, never a game or host page.
    path: `/api/night/invite/${code}`, expires: expiresAt };
}
export function invitationErrorResponse(error: unknown) {
  if (error instanceof InviteInputError) return NextResponse.json({ error: error.message },
    { status: error.status, headers: nightPrivateHeaders });
  return nightErrorResponse(error);
}
