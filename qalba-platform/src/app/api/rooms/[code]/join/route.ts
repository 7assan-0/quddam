import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { consumeAuthAttempt } from "@/lib/auth/rate-limit";
import { joinRoom, RoomError } from "@/lib/rooms/service";
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const { code } = await params;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    if (!await consumeAuthAttempt(`${code}:${ip}`, "room-join", 40)) return NextResponse.json({ error: "محاولات كثيرة. حاول لاحقًا" }, { status: 429 });
    const input = await parseJson(request, z.object({ name: z.string().min(2).max(60), teamId: z.string().min(1) }));
    return NextResponse.json(await joinRoom(code, input.name, input.teamId), { status: 201 });
  } catch (error) { if (error instanceof RoomError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
