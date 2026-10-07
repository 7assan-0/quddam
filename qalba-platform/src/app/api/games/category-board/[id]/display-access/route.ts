import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { errorResponse, forbidden, requireSameOrigin } from "@/lib/http";
import { createDisplayAccess, revokeDisplayAccess } from "@/lib/games/category-board/display-access";
import { GameRuleError } from "@/lib/games/category-board/module";
import QRCode from "qrcode";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
async function handle(request: NextRequest, id: string, revoke: boolean) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const user = await currentUser();
    if (!user) return forbidden();
    if (revoke) {
      await revokeDisplayAccess(user.id, id);
      return NextResponse.json({ revoked: true }, { headers });
    }
    const access = await createDisplayAccess(user.id, id);
    const url = `/display/${id}?token=${encodeURIComponent(access.token)}`;
    const origin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : request.nextUrl.origin;
    const qrDataUrl = await QRCode.toDataURL(new URL(url, origin).href, { width: 256, margin: 2, errorCorrectionLevel: "M" });
    return NextResponse.json({ url, expiresAt: access.expiresAt, qrDataUrl }, { headers });
  } catch (error) {
    if (error instanceof GameRuleError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, (await params).id, false);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, (await params).id, true);
}
