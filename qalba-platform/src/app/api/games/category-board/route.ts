import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { createBoardSession } from "@/lib/games/category-board/service";
import { createBoardSchema } from "@/lib/games/category-board/validation";
import { GameRuleError } from "@/lib/games/category-board/module";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const user = await currentUser();
    if (!user) return forbidden();
    const input = await parseJson(request, createBoardSchema);
    return NextResponse.json(await createBoardSession(user.id, input), { status: 201 });
  } catch (error) {
    if (error instanceof GameRuleError) return NextResponse.json({ error: error.message }, { status: error.status });
    return errorResponse(error);
  }
}
