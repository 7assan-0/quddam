import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { emailSchema } from "@/lib/auth/validation";
import { CreditError, grantAdminCredits } from "@/lib/billing/credits";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

const grantSchema = z.strictObject({ email: emailSchema, amount: z.number().int().min(1).max(100), key: z.uuid() });
export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const admin = await currentUser();
    if (admin?.role !== "ADMIN") return forbidden();
    const { email, amount, key } = await parseJson(request, grantSchema);
    return NextResponse.json(await grantAdminCredits(admin.id, email, amount, key));
  } catch (error) {
    if (error instanceof CreditError) return NextResponse.json({ error: error.message }, { status: error.status });
    return errorResponse(error);
  }
}
