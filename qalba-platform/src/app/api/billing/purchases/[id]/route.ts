import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reconcilePurchase } from "@/lib/billing/checkout";
import { PaymentError } from "@/lib/billing/provider";
import { errorResponse, forbidden, requireSameOrigin } from "@/lib/http";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try { const user = await currentUser(); if (!user) return forbidden(); const { id } = await params;
    const purchase = await db().purchase.findUnique({ where: { id } }); if (!purchase || purchase.userId !== user.id) return forbidden();
    const result = (purchase.status === "PENDING" || purchase.status === "PAID") && purchase.providerReference ? await reconcilePurchase(id) : purchase;
    return NextResponse.json({ status: result.status });
  } catch (error) { if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
