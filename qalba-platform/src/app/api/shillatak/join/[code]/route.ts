import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { requireSameOrigin } from "@/lib/http";
import { shillaEnabled, shillaInviteCodeSchema } from "@/lib/shillatak/rules";
import { acceptShillaInvite, previewShillaInvite } from "@/lib/shillatak/service";
import { denied, failure, privateHeaders } from "@/lib/shillatak/http";
type Context = { params: Promise<{ code: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  if (!shillaEnabled()) return denied(404);
  try {
    const user = await currentUser(); if (!user) return denied(401);
    const code = shillaInviteCodeSchema.parse((await params).code);
    return NextResponse.json({ invitation: await previewShillaInvite(user.id, code) }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  if (!shillaEnabled()) return denied(404);
  if (!requireSameOrigin(request)) return denied(403);
  try {
    const user = await currentUser(); if (!user) return denied(401);
    const code = shillaInviteCodeSchema.parse((await params).code);
    return NextResponse.json(await acceptShillaInvite(user.id, code), { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
