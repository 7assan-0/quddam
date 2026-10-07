import { NextRequest, NextResponse } from "next/server";
import { getSocialView } from "@/lib/games/social-deduction/service";
import { SocialError } from "@/lib/games/social-deduction/module";
import { errorResponse } from "@/lib/http";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await getSocialView((await params).id, { kind: "DISPLAY", token: request.nextUrl.searchParams.get("token") ?? "" }),
    { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }); }
  catch (error) { if (error instanceof SocialError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
