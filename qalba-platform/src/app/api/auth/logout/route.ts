import { NextRequest, NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth/session";
import { errorResponse, forbidden, requireSameOrigin } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    await revokeCurrentSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
