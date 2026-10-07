import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AdminError, adminErrorResponse } from "@/lib/admin/errors";
import { errorResponse, forbidden, parseJson, requireSameOrigin } from "@/lib/http";

const inputSchema = z.union([z.strictObject({ role: z.enum(["USER", "ADMIN"]) }), z.strictObject({ suspended: z.boolean() })]);
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return forbidden();
  try {
    const admin = await currentUser();
    if (admin?.role !== "ADMIN") return forbidden();
    const input = await parseJson(request, inputSchema);
    const { id } = await params;
    if (id === admin.id) throw new AdminError("لا يمكنك تغيير صلاحية حسابك أو إيقافه", 409);
    const result = await db().$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id }, select: { id: true, role: true, suspendedAt: true } });
      if (!target) throw new AdminError("الحساب غير موجود", 404);
      if (("role" in input && target.role === "ADMIN" && input.role === "USER") ||
          ("suspended" in input && input.suspended && target.role === "ADMIN")) {
        const activeAdmins = await tx.user.count({ where: { role: "ADMIN", suspendedAt: null } });
        if (activeAdmins <= 1 && !target.suspendedAt) throw new AdminError("يجب أن يبقى مسؤول نشط واحد على الأقل", 409);
      }
      return tx.user.update({ where: { id }, data: "role" in input ? { role: input.role } : { suspendedAt: input.suspended ? new Date() : null },
        select: { id: true, role: true, suspendedAt: true } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (error) { return adminErrorResponse(error) ?? errorResponse(error); }
}
