import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { joinSocialSession, socialPreview } from "@/lib/games/social-deduction/service";
import { SocialError } from "@/lib/games/social-deduction/module";
import { consumeAuthAttempt } from "@/lib/auth/rate-limit";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    if (!await consumeAuthAttempt(`${(await params).id}:${ip}`, "social-join", 40))
      return NextResponse.json({ error: "محاولات كثيرة. حاول لاحقًا" }, { status: 429 });
    const { code, name } = await parseJson(request, z.object({ code: z.string().length(6), name: z.string().min(2).max(60) }));
    const preview = await socialPreview(code);
    if (preview.id !== (await params).id) return forbidden();
    return NextResponse.json(await joinSocialSession(code, name, (await currentUser())?.id), { status: 201 });
  } catch (error) { if (error instanceof SocialError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status }); return errorResponse(error); }
}
