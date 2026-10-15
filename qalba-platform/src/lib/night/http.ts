import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { BodyTooLargeError, readBoundedText } from "@/lib/body";
import { isNightGame, type NightGameSlug } from "./catalog";
import { NightRuleError } from "./core";
import { NightServiceError } from "./service";

export const nightPrivateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
export const nightIdSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const teamName = z.string().min(2).max(60);
export const nightCreateSchema = z.object({
  key: z.uuid(),
  games: z.array(z.custom<NightGameSlug>(isNightGame, "اختر لعبة متوافقة مع السهرة")).min(3).max(10),
  teams: z.tuple([teamName, teamName]),
}).strict();
export const nightCommandSchema = z.object({
  key: z.uuid(),
  expectedVersion: z.number().int().min(0).max(1_000),
  op: z.enum(["START", "IMPORT", "NEXT", "END"]),
}).strict();

export function nightDenied(status = 403) {
  return NextResponse.json({ error: status === 404 ? "الصفحة غير متاحة" : "غير مصرح بهذا الإجراء" },
    { status, headers: nightPrivateHeaders });
}
export async function parseNightJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  return schema.parse(JSON.parse(await readBoundedText(request, 4_096)));
}
export function nightErrorResponse(error: unknown) {
  if (error instanceof NightServiceError) {
    return NextResponse.json({ error: error.message, code: error.code },
      { status: error.status, headers: nightPrivateHeaders });
  }
  if (error instanceof NightRuleError) {
    const conflict = ["CONFLICTING_REPLAY", "CLOSED_NIGHT", "UNEXPECTED_GAME", "INVALID_PHASE"].includes(error.code);
    return NextResponse.json({ error: "بيانات السهرة أو حالتها غير صالحة لهذا الإجراء", code: error.code },
      { status: conflict ? 409 : 400, headers: nightPrivateHeaders });
  }
  if (error instanceof BodyTooLargeError) {
    return NextResponse.json({ error: "حجم الطلب أكبر من الحد المسموح" },
      { status: 413, headers: nightPrivateHeaders });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: "تحقق من الألعاب والفرق وبيانات الطلب" },
      { status: 400, headers: nightPrivateHeaders });
  }
  // Do not reflect database errors, private source state, or credentials.
  return NextResponse.json({ error: "تعذر تحديث السهرة الآن. حاول مجددًا." },
    { status: 500, headers: nightPrivateHeaders });
}
