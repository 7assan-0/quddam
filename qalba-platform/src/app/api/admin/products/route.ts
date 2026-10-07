import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { productSchema } from "@/lib/admin/pricing";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try { if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, productSchema);
    return NextResponse.json(await db().product.create({ data: input }), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
