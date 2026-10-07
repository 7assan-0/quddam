import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { errorResponse, forbidden } from "@/lib/http";
import { getBoardSession } from "@/lib/games/category-board/service";
import { GameRuleError } from "@/lib/games/category-board/module";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return forbidden();
    const { id } = await params;
    return NextResponse.json(await getBoardSession(user.id, id));
  } catch (error) {
    if (error instanceof GameRuleError) return NextResponse.json({ error: error.message }, { status: error.status });
    return errorResponse(error);
  }
}
