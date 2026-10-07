import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

const schema = z.strictObject({ sessionId: z.string().min(1).max(100), questionId: z.string().min(1).max(100),
  reason: z.enum(["WRONG_ANSWER", "OUTDATED", "DUPLICATE", "UNCLEAR", "SPELLING", "INAPPROPRIATE", "OTHER"]), details: z.string().trim().max(1000).nullable() });
export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const user = await currentUser(); if (!user) return forbidden();
    const input = await parseJson(request, schema);
    const session = await db().gameSession.findFirst({ where: { id: input.sessionId,
      OR: [{ hostId: user.id }, { players: { some: { userId: user.id } } }], usedQuestions: { some: { questionId: input.questionId } } }, select: { id: true } });
    if (!session) return NextResponse.json({ error: "يمكن الإبلاغ عن سؤال ظهر لك في المباراة فقط" }, { status: 403 });
    const result = await db().questionReport.createMany({ data: [{ questionId: input.questionId, userId: user.id,
      reason: input.reason, details: input.details }], skipDuplicates: true });
    return NextResponse.json({ duplicate: result.count === 0 }, { status: result.count ? 201 : 200 });
  } catch (error) { return errorResponse(error); }
}
