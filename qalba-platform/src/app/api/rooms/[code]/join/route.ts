import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { consumeJoinAdmission, joinAdmissionTarget } from "@/lib/rooms/admission";
import { joinRoom, RoomError } from "@/lib/rooms/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const code = joinAdmissionTarget("board", (await params).code);
    if (!await consumeJoinAdmission(request, "board", code))
      return NextResponse.json({ error: "محاولات كثيرة. حاول لاحقًا" }, { status: 429, headers: { "Cache-Control": "no-store" } });
    const input = await parseJson(request, z.object({ name: z.string().min(2).max(60), teamId: z.string().min(1) }));
    return NextResponse.json(await joinRoom(code, input.name, input.teamId), { status: 201 });
  } catch (error) { if (error instanceof RoomError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
