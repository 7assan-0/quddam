import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { nightEnabled } from "@/lib/night/catalog";
import { getNightView } from "@/lib/night/service";
import { deriveNightHighlights } from "@/lib/night/highlights";
import { nightDenied, nightErrorResponse, nightIdSchema, nightPrivateHeaders } from "@/lib/night/http";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!nightEnabled()) return nightDenied(404);
  try {
    const user = await currentUser();
    if (!user) return nightDenied(401);
    const night = await getNightView(user.id, nightIdSchema.parse((await params).id));
    const highlights = deriveNightHighlights(night);
    if (!highlights) return NextResponse.json({ error: "الملخص متاح بعد انتهاء السهرة فقط" },
      { status: 409, headers: nightPrivateHeaders });
    return NextResponse.json({ highlights }, { headers: nightPrivateHeaders });
  } catch (error) { return nightErrorResponse(error); }
}
