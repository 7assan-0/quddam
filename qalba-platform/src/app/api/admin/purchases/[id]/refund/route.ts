import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { confirmSupportRefund, refundSummary } from "@/lib/billing/refunds";
import { PaymentError } from "@/lib/billing/provider";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

const input = z.strictObject({ providerReference: z.uuid(), paymentReference: z.uuid() });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const admin = await currentUser(); if (admin?.role !== "ADMIN") return forbidden();
    const { id } = await params, body = await parseJson(request, input);
    return NextResponse.json(await confirmSupportRefund(id, body.providerReference, body.paymentReference, admin.id));
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status });
    return errorResponse(error);
  }
}
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await currentUser(); if (admin?.role !== "ADMIN") return forbidden();
    const { id } = await params;
    const purchase = await db().purchase.findUnique({ where: { id }, select: { id: true, status: true, paidAt: true, amountHalalas: true, credits: true, refund: true } });
    if (!purchase) return NextResponse.json({ error: "الشراء غير موجود" }, { status: 404 });
    const events = await db().paymentEvent.findMany({ where: { purchaseId: id }, orderBy: { receivedAt: "asc" }, take: 50,
      select: { receivedAt: true, processedAt: true, source: true, eventType: true, observedState: true, processingResult: true, operatorId: true } });
    return NextResponse.json({ ...purchase, refund: purchase.refund ? refundSummary(purchase.refund) : null, events });
  } catch (error) { return errorResponse(error); }
}
