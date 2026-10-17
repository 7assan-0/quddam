import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { requireSameOrigin } from "@/lib/http";
import { nightEnabled } from "@/lib/night/catalog";
import { inviteInputSchema } from "@/lib/night/invitation";
import { createInvitation, ownerInvitation, revokeInvitation } from "@/lib/night/invitation-service";
import { invitationErrorResponse } from "@/lib/night/invitation-http";
import { nightDenied, nightIdSchema, nightPrivateHeaders, parseNightJson } from "@/lib/night/http";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  if (!nightEnabled()) return nightDenied(404);
  try {
    const user = await currentUser();
    if (!user) return nightDenied(401);
    const info = await ownerInvitation(user.id, nightIdSchema.parse((await params).id));
    return NextResponse.json({ invitation: info }, { headers: nightPrivateHeaders });
  } catch (error) { return invitationErrorResponse(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  if (!nightEnabled()) return nightDenied(404);
  if (!requireSameOrigin(request)) return nightDenied();
  try {
    const user = await currentUser();
    if (!user) return nightDenied(401);
    const input = await parseNightJson(request, inviteInputSchema);
    const info = await createInvitation(user.id, nightIdSchema.parse((await params).id), input);
    return NextResponse.json({ invitation: info }, { status: 201, headers: nightPrivateHeaders });
  } catch (error) { return invitationErrorResponse(error); }
}

/** Revocation consumes no JSON body and never creates or recovers a secret link. */
export async function DELETE(request: NextRequest, { params }: Context) {
  if (!nightEnabled()) return nightDenied(404);
  if (!requireSameOrigin(request)) return nightDenied();
  try {
    const user = await currentUser();
    if (!user) return nightDenied(401);
    const result = await revokeInvitation(user.id, nightIdSchema.parse((await params).id));
    return NextResponse.json(result, { headers: nightPrivateHeaders });
  } catch (error) { return invitationErrorResponse(error); }
}
