import { NextRequest } from "next/server";
import { getBoardDisplaySession } from "@/lib/games/category-board/display-access";
import { GameRuleError } from "@/lib/games/category-board/module";
import { realtimeResponse } from "@/lib/realtime/stream";
import { createViewPoll } from "@/lib/realtime/view-poll";
import { displayWatchFinished } from "@/lib/games/category-board/display-policy";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token") ?? "";
  let initial;
  try { initial = await getBoardDisplaySession(id, token); }
  catch (error) { return new Response(error instanceof GameRuleError ? error.message : "تعذّر الاتصال", { status: error instanceof GameRuleError ? error.status : 500 }); }

  return realtimeResponse(request, { sessionId: id, audience: "DISPLAY", credential: token, initial, cadence: 1000,
    // A final judgment can be undone. Continue the existing bounded, credential-checked stream
    // through the 30-minute completed grace window; invalid access still emits access-ended.
    next: createViewPoll({ id, initial, host: false, read: () => getBoardDisplaySession(id, token) }),
    complete: displayWatchFinished });
}
