import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { productSchema } from "@/lib/admin/pricing";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, productSchema); const { id } = await params;
    return NextResponse.json(await db().product.update({ where: { id }, data: input }));
  } catch (error) { return errorResponse(error); }
}
