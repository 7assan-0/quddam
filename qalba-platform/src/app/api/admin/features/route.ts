import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

const schema = z.strictObject({ key: z.string().regex(/^[a-z0-9-]{3,100}$/), enabled: z.boolean(), config: z.record(z.string(), z.unknown()) });
export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, schema);
    if (input.key === "welcome-credits") return NextResponse.json({ error: "إعداد رصيد البداية له صفحة مخصصة" }, { status: 409 });
    const config = input.config as Prisma.InputJsonValue;
    const flag = await db().featureFlag.upsert({ where: { key: input.key }, create: { ...input, config }, update: { enabled: input.enabled, config } });
    return NextResponse.json(flag);
  } catch (error) { return errorResponse(error); }
}
