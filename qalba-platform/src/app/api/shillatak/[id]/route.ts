import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { requireSameOrigin } from "@/lib/http";
import { shillaEnabled, shillaIdSchema } from "@/lib/shillatak/rules";
import { archiveShilla, attachShillaNight, createShillaInvite, getShillaView, leaveShilla, revokeShillaInvite } from "@/lib/shillatak/service";
import { actionsSchema, bounded, denied, failure, privateHeaders } from "@/lib/shillatak/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  if (!shillaEnabled()) return denied(404);
  try {
    const user = await currentUser(); if (!user) return denied(401);
    const id = shillaIdSchema.parse((await params).id);
    return NextResponse.json({ shilla: await getShillaView(user.id, id) }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  if (!shillaEnabled()) return denied(404);
  if (!requireSameOrigin(request)) return denied(403);
  try {
    const user = await currentUser(); if (!user) return denied(401);
    const id = shillaIdSchema.parse((await params).id);
    const input = await bounded(request, actionsSchema);
    if (input.op === "INVITE") return NextResponse.json({ invitation: await createShillaInvite(user.id, id) },
      { status: 201, headers: privateHeaders });
    if (input.op === "ATTACH") return NextResponse.json({ shilla: await attachShillaNight(user.id, id, input.nightId) },
      { headers: privateHeaders });
    if (input.op === "REVOKE") return NextResponse.json({ shilla: await revokeShillaInvite(user.id, id, input.inviteId) },
      { headers: privateHeaders });
    if (input.op === "ARCHIVE") return NextResponse.json({ shilla: await archiveShilla(user.id, id) },
      { headers: privateHeaders });
    return NextResponse.json(await leaveShilla(user.id, id), { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
