import { NextResponse } from "next/server";

export class AdminError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminError) return NextResponse.json({ error: error.message }, { status: error.status });
  return null;
}
