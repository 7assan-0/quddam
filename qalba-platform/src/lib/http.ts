import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { BODY_LIMITS, BodyTooLargeError, readBoundedText } from "@/lib/body";

export function requireSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const expected = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : `${request.nextUrl.protocol}//${host}`;
  return Boolean(origin && origin === expected);
}

export async function parseJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  const raw = await readBoundedText(request, BODY_LIMITS.json);
  return schema.parse(JSON.parse(raw));
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 });
  if (error instanceof BodyTooLargeError) return NextResponse.json({ error: "حجم الطلب أكبر من الحد المسموح" }, { status: 413 });
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "بيانات الطلب غير صحيحة" }, { status: 400 });
  }
  if (typeof error === "object" && error && "code" in error) {
    if (error.code === "P2002") return NextResponse.json({ error: "هذه القيمة مستخدمة بالفعل" }, { status: 409 });
    if (error.code === "P2034") return NextResponse.json({ error: "تزامن تعديل آخر مع طلبك. حاول مجددًا" }, { status: 409 });
    if (error.code === "P2025") return NextResponse.json({ error: "العنصر غير موجود" }, { status: 404 });
  }
  console.error(error);
  return NextResponse.json({ error: "تعذّر إكمال الطلب الآن. حاول مرة أخرى." }, { status: 500 });
}

export const forbidden = () => NextResponse.json({ error: "غير مصرح بهذا الإجراء" }, { status: 403 });
