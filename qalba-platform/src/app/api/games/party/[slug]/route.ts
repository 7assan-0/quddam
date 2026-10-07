import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { createPartySession } from "@/lib/games/party/service";
import { PartyError } from "@/lib/games/party/types";
import { setupSchema, slugSchema } from "@/lib/games/party/validation";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { isLaunchCreationAllowed } from "@/lib/games/launch-policy";
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { const user = await currentUser(); if (!user) return forbidden(); const slug = slugSchema.parse((await params).slug);
    if (!isLaunchCreationAllowed(slug, `/api/games/party/${slug}`)) throw new PartyError("اللعبة غير متاحة", 404);
    const input = await parseJson(request, setupSchema);
    return NextResponse.json(await createPartySession(user.id, slug, input), { status: 201 });
  } catch (error) { if (error instanceof PartyError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
