import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { applyPartyCommand } from "@/lib/games/party/service";
import { PartyError } from "@/lib/games/party/types";
import { commandSchema } from "@/lib/games/party/validation";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { const user = await currentUser(); if (!user) return forbidden(); const { id } = await params; const input = await parseJson(request, commandSchema);
    return NextResponse.json(await applyPartyCommand(user.id, id, input.key, input.expectedVersion, input.action));
  } catch (error) { if (error instanceof PartyError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
