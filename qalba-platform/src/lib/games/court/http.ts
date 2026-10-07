import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/http';
import { CreditError } from '@/lib/billing/credits';
import { CourtError } from './module';
export const privateHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export function courtResponse(e: unknown) { if (e instanceof CourtError || e instanceof CreditError) return NextResponse.json({ error: e.message, ...(e instanceof CourtError ? { code: e.code } : {}) }, { status: e.status, headers: privateHeaders }); return errorResponse(e); }
