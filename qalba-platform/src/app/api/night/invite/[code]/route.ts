import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { requireSameOrigin } from "@/lib/http";
import { nightEnabled } from "@/lib/night/catalog";
import { rsvpInputSchema } from "@/lib/night/invitation";
import { getPublicInvitation, respondToInvitation } from "@/lib/night/invitation-service";
import { invitationCapability, invitationCode, invitationCookieOptions, invitationErrorResponse } from "@/lib/night/invitation-http";
import { nightDenied, nightPrivateHeaders, parseNightJson } from "@/lib/night/http";
type Context = { params: Promise<{ code: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  if (!nightEnabled()) return nightDenied(404);
  try {
    const code = invitationCode((await params).code);
    const first = await getPublicInvitation(code);
    const capability = invitationCapability(request.cookies.get(first.cookieName)?.value);
    const result = capability ? await getPublicInvitation(code, capability) : first;
    const response = NextResponse.json({ invitation: result.view }, { headers: nightPrivateHeaders });
    // A pre-issued unpersisted capability survives a lost first POST response.
    if (!capability && first.view.open) response.cookies.set(first.cookieName, randomBytes(32).toString("hex"),
      invitationCookieOptions(code, first.expiresAt));
    return response;
  } catch (error) { return invitationErrorResponse(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  if (!nightEnabled()) return nightDenied(404);
  if (!requireSameOrigin(request)) return nightDenied();
  try {
    const code = invitationCode((await params).code);
    const input = await parseNightJson(request, rsvpInputSchema);
    const first = await getPublicInvitation(code);
    const result = await respondToInvitation(code, input, invitationCapability(request.cookies.get(first.cookieName)?.value));
    const response = NextResponse.json({ invitation: result.view }, { headers: nightPrivateHeaders });
    response.cookies.set(result.cookieName, result.cookieValue, invitationCookieOptions(code, result.expiresAt));
    return response;
  } catch (error) { return invitationErrorResponse(error); }
}
