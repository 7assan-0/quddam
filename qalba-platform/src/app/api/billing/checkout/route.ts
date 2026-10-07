import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { consumeAuthAttempt } from "@/lib/auth/rate-limit";
import { startCheckout } from "@/lib/billing/checkout";
import { PaymentError } from "@/lib/billing/provider";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

const schema = z.strictObject({ productId: z.string().min(1), couponCode: z.string().trim().max(40).optional(), key: z.string().uuid() });
export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try { const user = await currentUser(); if (!user) return forbidden();
    if (!(await consumeAuthAttempt(user.id, "checkout", 20))) return NextResponse.json({ error: "طلبات كثيرة. حاول بعد ساعة." }, { status: 429 });
    const input = await parseJson(request, schema); const purchase = await startCheckout(user.id, input.productId, input.couponCode || undefined, input.key);
    return NextResponse.json({ id: purchase.id, url: purchase.checkoutUrl, status: purchase.status });
  } catch (error) { if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
