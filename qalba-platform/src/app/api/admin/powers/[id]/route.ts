import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

const schema = z.strictObject({ enabled: z.boolean(), initialCount: z.number().int().min(0).max(10), seconds: z.number().int().min(1).max(120).optional() });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, schema);
    const { id } = await params;
    const power = await db().powerUp.findUnique({ where: { id }, select: { slug: true } });
    if (!power) return NextResponse.json({ error: "القدرة غير موجودة" }, { status: 404 });
    if (power.slug === "extra-time" && !input.seconds) return NextResponse.json({ error: "حدد ثواني الوقت الإضافي" }, { status: 400 });
    return NextResponse.json(await db().powerUp.update({ where: { id }, data: { enabled: input.enabled,
      config: power.slug === "extra-time" ? { initialCount: input.initialCount, seconds: input.seconds } : { initialCount: input.initialCount } } }));
  } catch (error) { return errorResponse(error); }
}
