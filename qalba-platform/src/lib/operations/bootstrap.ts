import type { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/crypto";
export class AdminBootstrapError extends Error {}

/** Explicit one-time operator action. Existing accounts, roles and credentials are never overwritten. */
export async function bootstrapFirstAdmin(client: PrismaClient, input: { email?: string; password?: string }) {
  return client.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(81821, 1)::text`;
    if (await tx.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })) return { status: "ADMIN_ALREADY_EXISTS" as const };
    const email = input.email?.trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !input.password || input.password.length < 12 || input.password.length > 200) throw new AdminBootstrapError("Explicit admin email and a 12–200 character password are required; values are never logged");
    if (await tx.user.findUnique({ where: { email }, select: { id: true } })) throw new AdminBootstrapError("Bootstrap email already belongs to an account; no automatic role promotion or credential overwrite");
    const passwordHash = await hashPassword(input.password);
    await tx.user.create({ data: { email, name: "مسؤول قدّام", role: "ADMIN", passwordHash, wallet: { create: { balance: 0 } } } });
    return { status: "ADMIN_CREATED" as const };
  });
}
