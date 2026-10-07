import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { previewRoom, RoomError } from "@/lib/rooms/service";
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try { return NextResponse.json(await previewRoom((await params).code), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { if (error instanceof RoomError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
