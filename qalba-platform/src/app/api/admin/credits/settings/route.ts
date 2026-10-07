import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { setWelcomeCredits } from "@/lib/billing/credits";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

const settingSchema = z.strictObject({ count: z.number().int().min(0).max(20), enabled: z.boolean() });
export async function PATCH(request: NextRequest) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const { count, enabled } = await parseJson(request, settingSchema);
    const setting = await setWelcomeCredits(count, enabled);
    return NextResponse.json({ count, enabled: setting.enabled });
  } catch (error) { return errorResponse(error); }
}
