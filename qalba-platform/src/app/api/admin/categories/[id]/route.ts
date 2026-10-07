import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { categorySchema } from "@/lib/questions/validation";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, categorySchema.partial());
    const { id } = await params;
    const category = await db().category.update({ where: { id }, data: input });
    return NextResponse.json(category);
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const { id } = await params;
    const category = await db().category.update({ where: { id }, data: { active: false } });
    return NextResponse.json(category);
  } catch (error) { return errorResponse(error); }
}
