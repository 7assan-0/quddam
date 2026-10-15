import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { requireSameOrigin } from "@/lib/http";
import { nightEnabled } from "@/lib/night/catalog";
import { applyNightCommand } from "@/lib/night/service";
import { nightCommandSchema, nightDenied, nightErrorResponse, nightIdSchema, nightPrivateHeaders, parseNightJson } from "@/lib/night/http";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!nightEnabled()) return nightDenied(404);
  if (!requireSameOrigin(request)) return nightDenied();
  try {
    const user = await currentUser();
    if (!user) return nightDenied(401);
    const id = nightIdSchema.parse((await context.params).id);
    const input = await parseNightJson(request, nightCommandSchema);
    const night = await applyNightCommand(user.id, id, input);
    return NextResponse.json({ night }, { headers: nightPrivateHeaders });
  } catch (error) { return nightErrorResponse(error); }
}
