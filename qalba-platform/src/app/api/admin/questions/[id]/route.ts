import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { questionSchema } from "@/lib/questions/validation";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, questionSchema);
    const { id } = await params;
    const question = await db().question.update({ where: { id }, data: { ...input, options: input.options ?? undefined } });
    return NextResponse.json(question);
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const { id } = await params;
    const question = await db().question.update({ where: { id }, data: { status: "ARCHIVED" } });
    return NextResponse.json(question);
  } catch (error) { return errorResponse(error); }
}
