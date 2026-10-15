import { NextResponse } from "next/server";
import { InviteInputError } from "./invitation";
import { nightErrorResponse, nightPrivateHeaders } from "./http";
export function invitationErrorResponse(error: unknown) {
  if (error instanceof InviteInputError) return NextResponse.json({ error: error.message },
    { status: error.status, headers: nightPrivateHeaders });
  return nightErrorResponse(error);
}
