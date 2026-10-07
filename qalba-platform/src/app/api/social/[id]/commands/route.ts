import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { applySocialCommand, socialActor } from "@/lib/games/social-deduction/service";
import { SocialError } from "@/lib/games/social-deduction/module";
import { socialCommandSchema } from "@/lib/games/social-deduction/validation";
import { CreditError } from "@/lib/billing/credits";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { const id = (await params).id; const input = await parseJson(request, socialCommandSchema);
    const user = await currentUser();
    const actor = ["FINISH_TURN", "SUBMIT_VOTE", "SUBMIT_GUESS"].includes(input.action.type) ? await socialActor(id) : await socialActor(id, user?.id);
    return NextResponse.json(await applySocialCommand(id, actor, input.key, input.expectedVersion, input.action));
  } catch (error) { if (error instanceof SocialError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
