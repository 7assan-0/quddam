import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { reconcilePurchase } from "@/lib/billing/checkout";
import { PaymentError } from "@/lib/billing/provider";
import { BODY_LIMITS, BodyTooLargeError, readBoundedText } from "@/lib/body";

// A documented payment webhook is still only an invoice hint; ignore status/amount/body secrets.
const payload = z.union([
  z.object({ type: z.enum(["payment_paid", "payment_failed", "payment_refunded", "payment_voided", "payment_captured"]), data: z.object({ id: z.uuid(), invoice_id: z.uuid() }) }),
  z.object({ id: z.string().uuid() }),
]);
export async function POST(request: NextRequest) {
  const expected = process.env.MOYASAR_CALLBACK_TOKEN ?? "", actual = request.nextUrl.searchParams.get("token") ?? "";
  if (expected.length < 32 || actual.length !== expected.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  try {
    const body = await readBoundedText(request, BODY_LIMITS.billingCallback);
    const input = payload.parse(JSON.parse(body));
    const purchase = await db().purchase.findUnique({ where: { providerReference: "data" in input ? input.data.invoice_id : input.id } });
    if (!purchase) return NextResponse.json({ error: "فاتورة غير معروفة" }, { status: 404 });
    await reconcilePurchase(purchase.id, undefined, "CALLBACK"); return NextResponse.json({ ok: true });
  } catch (error) { if (error instanceof BodyTooLargeError) return NextResponse.json({ error: "طلب كبير" }, { status: 413 }); if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: "تعذر التحقق" }, { status: 503 }); }
}
