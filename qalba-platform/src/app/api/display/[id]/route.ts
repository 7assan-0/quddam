import { NextRequest, NextResponse } from "next/server";
import { getBoardDisplaySession } from "@/lib/games/category-board/display-access";
import { GameRuleError } from "@/lib/games/category-board/module";
import { errorResponse } from "@/lib/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getBoardDisplaySession((await params).id, request.nextUrl.searchParams.get("token") ?? "");
    return NextResponse.json(session, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    if (error instanceof GameRuleError) return NextResponse.json({ error: error.message }, { status: error.status });
    return errorResponse(error);
  }
}
