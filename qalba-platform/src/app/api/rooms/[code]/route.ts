import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { roomView, RoomError } from "@/lib/rooms/service";
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try { return NextResponse.json(await roomView((await params).code), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { if (error instanceof RoomError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
