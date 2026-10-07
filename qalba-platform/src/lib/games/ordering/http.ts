import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { CreditError } from "@/lib/billing/credits";
import { OrderingError } from "./module";
export const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export function orderingResponse(error: unknown) { if (error instanceof OrderingError || error instanceof CreditError) return NextResponse.json({ error: error.message, ...(error instanceof OrderingError ? { code: error.code } : {}) }, { status: error.status, headers: privateHeaders }); return errorResponse(error); }
