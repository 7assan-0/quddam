import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { wordSchema } from "@/lib/games/social-deduction/validation";
export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try { if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, wordSchema);
    if (!await db().category.findUnique({ where: { id: input.categoryId } })) return NextResponse.json({ error: "الفئة غير موجودة" }, { status: 400 });
    return NextResponse.json(await db().secretWord.create({ data: input }), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
