import { NextRequest, NextResponse } from "next/server";
import { forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { lightningResponse, privateHeaders } from "@/lib/games/lightning/http";
import { getLightningView, applyBuzz } from "@/lib/games/lightning/service";
import { buzzSchema } from "@/lib/games/lightning/validation";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { return NextResponse.json(await getLightningView((await params).id, { kind: "BUZZER", token: request.nextUrl.searchParams.get("token") ?? "" }), { headers: privateHeaders }); } catch (error) { return lightningResponse(error); } }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "", input = await parseJson(request, buzzSchema); return NextResponse.json(await applyBuzz((await params).id, token, input.key, input.expectedVersion), { headers: privateHeaders }); } catch (error) { return lightningResponse(error); }
}
