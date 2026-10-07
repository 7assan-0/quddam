import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { CreditError } from "@/lib/billing/credits";
import { LightningError } from "./module";
export const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export function lightningResponse(error: unknown) { if (error instanceof LightningError || error instanceof CreditError) return NextResponse.json({ error: error.message, ...(error instanceof LightningError ? { code: error.code } : {}) }, { status: error.status, headers: privateHeaders }); return errorResponse(error); }
