import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

const schema = z.strictObject({ status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]), archiveQuestion: z.boolean() });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, schema); const { id } = await params;
    if (input.archiveQuestion && input.status !== "RESOLVED") return NextResponse.json({ error: "أرشف السؤال بعد معالجة البلاغ" }, { status: 400 });
    const result = await db().$transaction(async tx => {
      const report = await tx.questionReport.update({ where: { id }, data: { status: input.status,
        resolvedAt: ["RESOLVED", "DISMISSED"].includes(input.status) ? new Date() : null } });
      if (input.archiveQuestion) await tx.question.update({ where: { id: report.questionId }, data: { status: "ARCHIVED" } });
      return report;
    });
    return NextResponse.json(result);
  } catch (error) { return errorResponse(error); }
}
