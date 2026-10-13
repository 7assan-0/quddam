import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { joinSocialSession, socialPreview } from "@/lib/games/social-deduction/service";
import { SocialError } from "@/lib/games/social-deduction/module";
import { consumeJoinAdmission } from "@/lib/rooms/admission";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const { id } = await params;
    if (!await consumeJoinAdmission(request, "social", id))
      return NextResponse.json({ error: "محاولات كثيرة. حاول لاحقًا" }, { status: 429, headers: { "Cache-Control": "no-store" } });
    const { code, name } = await parseJson(request, z.object({ code: z.string().length(6), name: z.string().min(2).max(60) }));
    const preview = await socialPreview(code);
    if (preview.id !== id) return forbidden();
    return NextResponse.json(await joinSocialSession(code, name, (await currentUser())?.id), { status: 201 });
  } catch (error) { if (error instanceof SocialError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status }); return errorResponse(error); }
}
