import { NextResponse } from "next/server";
import { socialActor, getSocialView } from "@/lib/games/social-deduction/service";
import { SocialError } from "@/lib/games/social-deduction/module";
import { errorResponse } from "@/lib/http";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const id = (await params).id; return NextResponse.json(await getSocialView(id, await socialActor(id)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { if (error instanceof SocialError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status }); return errorResponse(error); }
}
