import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/http";
export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await currentUser(); if (!user) return forbidden();
  const sessionId = (await params).sessionId;
  const session = await db().gameSession.findUnique({ where: { id: sessionId }, include: { room: true } });
  if (!session || session.hostId !== user.id) return forbidden();
  return NextResponse.json({ code: session.room?.code ?? null }, { headers: { "Cache-Control": "no-store" } });
}
