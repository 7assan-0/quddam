import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { validateImport } from "@/lib/admin/csv";
import { errorResponse, forbidden, requireSameOrigin } from "@/lib/http";
import { BODY_LIMITS, BodyTooLargeError, readBoundedText } from "@/lib/body";

const schema = z.strictObject({ csv: z.string().min(1).max(500_000), dryRun: z.boolean() });
export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const raw = await readBoundedText(request, BODY_LIMITS.questionImport);
    const { csv, dryRun } = schema.parse(JSON.parse(raw));
    const [games, categories] = await Promise.all([
      db().gameType.findMany({ select: { id: true, slug: true } }), db().category.findMany({ select: { id: true, slug: true } }),
    ]);
    const review = validateImport(csv, new Map(games.map(game => [game.slug, game.id])), new Map(categories.map(category => [category.slug, category.id])));
    if (review.errors.length || !review.total) return NextResponse.json({ total: review.total, valid: review.parsed.length, errors: review.errors.length ? review.errors : [{ row: 1, message: "الملف لا يحتوي أسئلة" }] }, { status: dryRun ? 200 : 400 });
    const checkAndWrite = async (tx: Prisma.TransactionClient) => {
      const duplicates = await tx.question.findMany({ where: { OR: review.parsed.map(item => ({ gameTypeId: item.gameTypeId, categoryId: item.categoryId,
        question: { equals: item.question, mode: "insensitive" as const } })) }, select: { question: true, gameTypeId: true, categoryId: true } });
      const existing = new Set(duplicates.map(item => `${item.gameTypeId}:${item.categoryId}:${item.question.toLocaleLowerCase("ar")}`));
      const repeated = review.parsed.flatMap((item, index) => existing.has(`${item.gameTypeId}:${item.categoryId}:${item.question.toLocaleLowerCase("ar")}`) ? [{ row: index + 2, message: "السؤال موجود في بنك الأسئلة" }] : []);
      if (repeated.length || dryRun) return { total: review.total, valid: review.parsed.length - repeated.length, errors: repeated, created: 0 };
      const result = await tx.question.createMany({ data: review.parsed.map(item => ({ ...item, options: item.options ?? undefined })) });
      return { total: review.total, valid: review.parsed.length, errors: [], created: result.count };
    };
    const result = await db().$transaction(checkAndWrite, { isolationLevel: "Serializable" });
    if (result.errors.length) return NextResponse.json(result, { status: dryRun ? 200 : 409 });
    return NextResponse.json(result, { status: dryRun ? 200 : 201 });
  } catch (error) {
    if (error instanceof BodyTooLargeError) return NextResponse.json({ error: "حجم الملف أكبر من الحد المسموح" }, { status: 413 });
    if (error instanceof Error && error.message.startsWith("أعمدة CSV") || error instanceof Error && /CSV|الحد الأقصى/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error);
  }
}
