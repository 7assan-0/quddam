import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { categorySchema } from "@/lib/questions/validation";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, categorySchema);
    const category = await db().category.create({ data: input });
    return NextResponse.json(category, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
