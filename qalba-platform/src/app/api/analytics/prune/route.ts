import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { pruneAnalytics } from "@/lib/analytics/events";
export async function POST(request: NextRequest) {
  const secret = process.env.ANALYTICS_CRON_SECRET ?? "", actual = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (secret.length < 32 || actual.length !== secret.length || !timingSafeEqual(Buffer.from(secret), Buffer.from(actual))) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const result = await pruneAnalytics(); return NextResponse.json({ deleted: result.count });
}
