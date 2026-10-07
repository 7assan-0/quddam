import { NextRequest, NextResponse } from "next/server";
import { forbidden, parseJson, requireSameOrigin } from "@/lib/http";
import { orderingResponse, privateHeaders } from "@/lib/games/ordering/http";
import { getOrderingView, applyOrder } from "@/lib/games/ordering/service";
import { orderSchema } from "@/lib/games/ordering/validation";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { return NextResponse.json(await getOrderingView((await params).id, { kind: "CONTROLLER", token: request.nextUrl.searchParams.get("token") ?? "" }), { headers: privateHeaders }); } catch (error) { return orderingResponse(error); } }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "", input = await parseJson(request, orderSchema); return NextResponse.json(await applyOrder((await params).id, token, input.key, input.expectedRevision, input.action), { headers: privateHeaders }); } catch (error) { return orderingResponse(error); }
}
