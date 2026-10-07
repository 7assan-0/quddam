import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { setReady, RoomError } from "@/lib/rooms/service";
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { const { ready } = await parseJson(request, z.object({ ready: z.boolean() })); return NextResponse.json(await setReady((await params).code, ready)); }
  catch (error) { if (error instanceof RoomError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
