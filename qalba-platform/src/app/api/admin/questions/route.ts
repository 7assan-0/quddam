import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { questionSchema } from "@/lib/questions/validation";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, questionSchema);
    const question = await db().question.create({ data: { ...input, options: input.options ?? undefined } });
    return NextResponse.json(question, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
