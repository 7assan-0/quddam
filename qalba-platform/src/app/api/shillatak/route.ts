import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { requireSameOrigin } from "@/lib/http";
import { shillaCreateSchema, shillaEnabled } from "@/lib/shillatak/rules";
import { createShilla, listMyShillas } from "@/lib/shillatak/service";
import { bounded, denied, failure, privateHeaders } from "@/lib/shillatak/http";

export async function GET() {
  if (!shillaEnabled()) return denied(404);
  try {
    const user = await currentUser(); if (!user) return denied(401);
    return NextResponse.json({ shillas: await listMyShillas(user.id) }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  if (!shillaEnabled()) return denied(404);
  if (!requireSameOrigin(request)) return denied(403);
  try {
    const user = await currentUser(); if (!user) return denied(401);
    const input = await bounded(request, shillaCreateSchema);
    return NextResponse.json({ shilla: await createShilla(user.id, input) },
      { status: 201, headers: privateHeaders });
  } catch (error) { return failure(error); }
}
