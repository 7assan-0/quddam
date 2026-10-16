import { NextResponse, type NextRequest } from "next/server";
import { BodyTooLargeError, readBoundedText } from "@/lib/body";
import { z, ZodError, type ZodType } from "zod";
import { ShillaError } from "./rules";
export const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow" };
export const actionsSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("INVITE") }).strict(),
  z.object({ op: z.literal("ATTACH"), nightId: z.uuid() }).strict(),
  z.object({ op: z.literal("ARCHIVE") }).strict(),
  z.object({ op: z.literal("REVOKE"), inviteId: z.uuid() }).strict(),
  z.object({ op: z.literal("LEAVE") }).strict(),
]);
const emptyJoinSchema = z.object({}).strict();
/** An invite path supplies the capability; no request body may supply authority. */
export async function boundedJoin(request: NextRequest) {
  const raw = await readBoundedText(request, 4096);
  return emptyJoinSchema.parse(raw.trim() ? JSON.parse(raw) : {});
}
export async function bounded<T>(request: NextRequest, schema: ZodType<T>) {
  return schema.parse(JSON.parse(await readBoundedText(request, 4096)));
}
export const denied = (status: number) => NextResponse.json({ error: status === 404 ? "غير متاح" :
  "غير مصرح" }, { status, headers: privateHeaders });
export function failure(error: unknown) {
  if (error instanceof ShillaError) return NextResponse.json({ error: error.message, code: error.code },
    { status: error.status, headers: privateHeaders });
  if (error instanceof BodyTooLargeError) return NextResponse.json({ error: "الطلب كبير جدًا" },
    { status: 413, headers: privateHeaders });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "تحقق من حقول الطلب" },
    { status: 400, headers: privateHeaders });
  if (error && typeof error === "object" && "code" in error && (error.code === "P2002" || error.code === "P2034"))
    return NextResponse.json({ error: "تعارض مع تعديل آخر. اقرأ الحالة وأعد المحاولة." },
      { status: 409, headers: privateHeaders });
  // Do not reflect identifiers, database details or invitation secrets.
  return NextResponse.json({ error: "تعذر إكمال العملية الآن" }, { status: 500, headers: privateHeaders });
}
