import { NextResponse, type NextRequest } from "next/server";
import { requireSameOrigin } from "@/lib/http";
import { nightEnabled } from "@/lib/night/catalog";
import { rsvpInputSchema } from "@/lib/night/invitation";
import { getPublicInvitation, respondToInvitation } from "@/lib/night/invitation-service";
import { invitationErrorResponse } from "@/lib/night/invitation-http";
import { nightDenied, nightPrivateHeaders, parseNightJson } from "@/lib/night/http";
type Context = { params: Promise<{ code: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  if (!nightEnabled()) return nightDenied(404);
  try {
    const { code } = await params;
    const first = await getPublicInvitation(code);
    const capability = request.cookies.get(first.cookieName)?.value;
    const result = capability ? await getPublicInvitation(code, capability) : first;
    return NextResponse.json({ invitation: result.view }, { headers: nightPrivateHeaders });
  } catch (error) { return invitationErrorResponse(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  if (!nightEnabled()) return nightDenied(404);
  if (!requireSameOrigin(request)) return nightDenied();
  try {
    const { code } = await params;
    const first = await getPublicInvitation(code);
    const input = await parseNightJson(request, rsvpInputSchema);
    const result = await respondToInvitation(code, input, request.cookies.get(first.cookieName)?.value);
    const response = NextResponse.json({ invitation: result.view }, { headers: nightPrivateHeaders });
    response.cookies.set(result.cookieName, result.cookieValue, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", expires: result.expiresAt,
    });
    return response;
  } catch (error) { return invitationErrorResponse(error); }
}
