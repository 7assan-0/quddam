import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { currentUser } from "@/lib/auth/session";
import { forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { lightningResponse, privateHeaders } from "@/lib/games/lightning/http";
import { createLightningBuzzerAccess, revokeLightningBuzzerAccess } from "@/lib/games/lightning/service";
import { accessSchema } from "@/lib/games/lightning/validation";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { const user = await currentUser(); if (!user) return forbidden(); const { teamId } = await parseJson(request, accessSchema), { id } = await params, access = await createLightningBuzzerAccess(user.id, id, teamId), url = new URL(`/lightning/buzzer/${id}?token=${access.token}`, process.env.APP_URL ?? request.nextUrl.origin).href; return NextResponse.json({ url, expiresAt: access.expiresAt, qr: await QRCode.toDataURL(url, { width: 180, margin: 2 }) }, { headers: privateHeaders }); } catch (error) { return lightningResponse(error); }
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { const user = await currentUser(); if (!user) return forbidden(); const { teamId } = await parseJson(request, accessSchema); await revokeLightningBuzzerAccess(user.id, (await params).id, teamId); return NextResponse.json({ revoked: true }, { headers: privateHeaders }); } catch (error) { return lightningResponse(error); }
}
