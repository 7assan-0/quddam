import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { couponSchema } from "@/lib/admin/pricing";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, couponSchema); const { id } = await params;
    return NextResponse.json(await db().coupon.update({ where: { id }, data: { ...input, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } }));
  } catch (error) { return errorResponse(error); }
}
