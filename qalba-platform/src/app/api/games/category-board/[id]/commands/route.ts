import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { applyBoardCommand } from "@/lib/games/category-board/service";
import { GameRuleError } from "@/lib/games/category-board/module";
import { CreditError } from "@/lib/billing/credits";
import { boardCommandSchema } from "@/lib/games/category-board/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const user = await currentUser();
    if (!user) return forbidden();
    const { id } = await params;
    const input = await parseJson(request, boardCommandSchema);
    return NextResponse.json(await applyBoardCommand(user.id, id, input.key, input.expectedVersion, input.action));
  } catch (error) {
    if (error instanceof GameRuleError) return NextResponse.json({ error: error.message, code: error.code ?? "GAME_RULE_ERROR" }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message }, { status: error.status });
    return errorResponse(error);
  }
}
