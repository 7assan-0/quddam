import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { createRoom, RoomError } from "@/lib/rooms/service";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const user = await currentUser(); if (!user) return forbidden();
    const { sessionId } = await parseJson(request, z.object({ sessionId: z.string().min(1) }));
    return NextResponse.json(await createRoom(user.id, sessionId), { status: 201 });
  } catch (error) { if (error instanceof RoomError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
