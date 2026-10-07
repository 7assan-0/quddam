import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { getPartySession } from "@/lib/games/party/service";
import { PartyError } from "@/lib/games/party/types";
import { errorResponse, forbidden } from "@/lib/http";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const user = await currentUser(); if (!user) return forbidden(); const { id } = await params;
    return NextResponse.json(await getPartySession(user.id, id, request.nextUrl.searchParams.get("display") === "1"));
  } catch (error) { if (error instanceof PartyError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
