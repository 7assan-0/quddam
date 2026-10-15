import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { requireSameOrigin } from "@/lib/http";
import { nightEnabled } from "@/lib/night/catalog";
import { createNightSession } from "@/lib/night/service";
import { nightCreateSchema, nightDenied, nightErrorResponse, nightPrivateHeaders, parseNightJson } from "@/lib/night/http";

export async function POST(request: NextRequest) {
  if (!nightEnabled()) return nightDenied(404);
  if (!requireSameOrigin(request)) return nightDenied();
  try {
    const user = await currentUser();
    if (!user) return nightDenied(401);
    const input = await parseNightJson(request, nightCreateSchema);
    const night = await createNightSession(user.id, input);
    return NextResponse.json({ night }, { status: 201, headers: nightPrivateHeaders });
  } catch (error) { return nightErrorResponse(error); }
}
