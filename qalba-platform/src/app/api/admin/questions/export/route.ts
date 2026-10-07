import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { columns, toCsv } from "@/lib/admin/csv";
import { errorResponse, forbidden } from "@/lib/http";

export async function GET() {
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const count = await db().question.count();
    if (count > 10000) return NextResponse.json({ error: "يتجاوز التصدير ١٠٬٠٠٠ سؤال. قسّم التصدير إلى دفعات قبل المتابعة" }, { status: 413 });
    const questions = await db().question.findMany({ include: { gameType: { select: { slug: true } }, category: { select: { slug: true } } }, orderBy: { createdAt: "asc" } });
    const csv = toCsv([ [...columns], ...questions.map(q => [q.gameType.slug, q.category.slug, q.question, q.answer, q.alternativeAnswers.join("|"), q.explanation,
      q.difficulty, q.pointValue, q.type, Array.isArray(q.options) ? q.options.join("|") : "", q.source, q.status, q.language, q.country, q.subcategory, q.imageUrl]) ]);
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=qalba-questions.csv", "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
