import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { nightEnabled } from "@/lib/night/catalog";
import { getNightView } from "@/lib/night/service";
import { nightDenied, nightErrorResponse, nightIdSchema, nightPrivateHeaders } from "@/lib/night/http";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!nightEnabled()) return nightDenied(404);
  try {
    const user = await currentUser();
    if (!user) return nightDenied(401);
    const id = nightIdSchema.parse((await context.params).id);
    const night = await getNightView(user.id, id);
    return NextResponse.json({ night }, { headers: nightPrivateHeaders });
  } catch (error) { return nightErrorResponse(error); }
}
