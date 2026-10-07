import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { createSocialSession } from "@/lib/games/social-deduction/service";
import { SocialError } from "@/lib/games/social-deduction/module";
export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const user = await currentUser(); if (!user) return forbidden();
    const { timerSeconds } = await parseJson(request, z.object({ timerSeconds: z.number().int().optional().default(30) }));
    return NextResponse.json(await createSocialSession(user.id, timerSeconds), { status: 201 });
  } catch (error) { if (error instanceof SocialError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status }); return errorResponse(error); }
}
