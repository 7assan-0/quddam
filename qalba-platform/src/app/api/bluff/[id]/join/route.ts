import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { bluffResponse, privateHeaders } from "@/lib/games/bluff/http";
import { cookieName, joinBluff } from "@/lib/games/bluff/service";
import { joinSchema } from "@/lib/games/bluff/validation";
import { consumeJoinAdmission } from "@/lib/rooms/admission";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const { id } = await params;
    if (!await consumeJoinAdmission(request, "bluff", id))
      return NextResponse.json({ error: "محاولات كثيرة. حاول لاحقًا" }, { status: 429, headers: privateHeaders });
    const input = await parseJson(request, joinSchema), user = await currentUser();
    return NextResponse.json(await joinBluff(id, input.code, input.name, request.cookies.get(cookieName(id))?.value, user?.id), { headers: privateHeaders });
  } catch (error) { return bluffResponse(error); }
}
