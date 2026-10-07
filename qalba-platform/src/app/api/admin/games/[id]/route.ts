import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { isLaunchGameSlug } from "@/lib/games/launch-policy";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const { enabled } = await parseJson(request, z.strictObject({ enabled: z.boolean() }));
    const { id } = await params;
    const game = await db().gameType.findUnique({ where: { id }, select: { slug: true } });
    if (!game) return NextResponse.json({ error: "اللعبة غير موجودة" }, { status: 404 });
    if (enabled && !isLaunchGameSlug(game.slug)) return NextResponse.json({ error: "اللعبة ليست ضمن ألعاب الإطلاق" }, { status: 409 });
    return NextResponse.json(await db().gameType.update({ where: { id }, data: { enabled } }));
  } catch (error) { return errorResponse(error); }
}
