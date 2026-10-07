import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { submitResponse, RoomError } from "@/lib/rooms/service";
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { const { response, vote } = await parseJson(request, z.object({ response: z.string().min(1).max(300), vote: z.boolean().default(false) }));
    return NextResponse.json(await submitResponse((await params).code, response, vote)); }
  catch (error) { if (error instanceof RoomError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
