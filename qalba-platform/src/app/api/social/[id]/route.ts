import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { forbidden, errorResponse } from "@/lib/http";
import { getSocialView } from "@/lib/games/social-deduction/service";
import { SocialError } from "@/lib/games/social-deduction/module";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const user = await currentUser(); if (!user) return forbidden();
    return NextResponse.json(await getSocialView((await params).id, { kind: "HOST", id: user.id }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { if (error instanceof SocialError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
