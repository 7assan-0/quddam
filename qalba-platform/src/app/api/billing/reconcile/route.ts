import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { reconcileBatch, reconcilePaidRefundBatch } from "@/lib/billing/reconciliation";

export async function POST(request: NextRequest) {
  const expected = process.env.BILLING_CRON_SECRET ?? "", token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (expected.length < 32 || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const result = await reconcileBatch();
  const { outcomes: _outcomes, ...summary } = result;
  void _outcomes;
  const refunds = await reconcilePaidRefundBatch();
  return NextResponse.json({ ...summary, refunds }, { status: result.failures || refunds.failures ? 503 : 200 });
}
