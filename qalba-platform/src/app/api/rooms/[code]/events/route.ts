import { roomView, RoomError } from "@/lib/rooms/service";
import { errorResponse } from "@/lib/http";
import { NextResponse } from "next/server";
import { currentAuthSession } from "@/lib/auth/session";
import { createHostSessionGuard } from "@/lib/auth/host-stream";
import { realtimeResponse } from "@/lib/realtime/stream";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const initial = await roomView(code); let version = initial.version;
    const auth = initial.host ? await currentAuthSession() : null;
    if (initial.host && !auth) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const hostSession = auth ? createHostSessionGuard(auth) : undefined;
    // roomView revalidates currentUser/participant access on every read; no retained host actor.
    return realtimeResponse(request, { sessionId: initial.session.id, audience: initial.host ? "ROOM_HOST" : "ROOM_PLAYER", credential: initial.host ? auth!.sessionId : initial.selfId ?? "", initial, cadence: 1500, assertActive: hostSession ? () => hostSession.assertActive() : undefined, lifetimeMs: 25_000,
      next: async () => { const view = await roomView(code); const changed = view.version !== version; version = view.version; return changed ? view : null; } });
  } catch (error) { if (error instanceof RoomError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
