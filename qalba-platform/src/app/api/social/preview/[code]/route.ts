import { NextResponse } from "next/server";
import { socialPreview } from "@/lib/games/social-deduction/service";
import { SocialError } from "@/lib/games/social-deduction/module";
import { errorResponse } from "@/lib/http";
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try { return NextResponse.json(await socialPreview((await params).code), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { if (error instanceof SocialError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
