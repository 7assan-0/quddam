import { db } from "@/lib/db";

export const HOST_AUTH_REVALIDATION_MS = 20_000;
export type ActiveAuthSessionResult =
  | { status: "ACTIVE"; expiresAt: Date }
  | { status: "AUTH_INVALID" }
  | { status: "TRANSIENT_FAILURE" };
type HostSessionBinding = { sessionId: string; expiresAt: Date; user: { id: string } };

/** Revalidate the original session, never another login belonging to this user. */
export async function validateActiveAuthSession(sessionId: string, expectedUserId: string): Promise<ActiveAuthSessionResult> {
  try {
    const session = await db().authSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, revokedAt: true, expiresAt: true, user: { select: { id: true, suspendedAt: true } } },
    });
    if (!session || session.userId !== expectedUserId || session.user.id !== expectedUserId ||
        session.revokedAt || session.expiresAt.getTime() <= Date.now() || session.user.suspendedAt) {
      return { status: "AUTH_INVALID" };
    }
    return { status: "ACTIVE", expiresAt: session.expiresAt };
  } catch {
    // A lookup failure is not evidence of revocation; never mutate auth state.
    return { status: "TRANSIENT_FAILURE" };
  }
}
export class HostAuthInvalidError extends Error {}
export class HostAuthTransientError extends Error {}

/** Per-stream cadence only: no global cache and no lookup per gameplay tick. */
export function createHostSessionGuard(binding: HostSessionBinding) {
  const sessionId = binding.sessionId, userId = binding.user.id;
  let expiresAt = binding.expiresAt.getTime();
  let nextValidation = Date.now() + HOST_AUTH_REVALIDATION_MS;
  let invalid = false;
  return {
    async assertActive(): Promise<void> {
      if (invalid || Date.now() >= expiresAt) {
        invalid = true;
        throw new HostAuthInvalidError();
      }
      if (Date.now() < nextValidation) return;
      const result = await validateActiveAuthSession(sessionId, userId);
      if (result.status === "AUTH_INVALID") {
        invalid = true;
        throw new HostAuthInvalidError();
      }
      if (result.status === "TRANSIENT_FAILURE") throw new HostAuthTransientError();
      expiresAt = result.expiresAt.getTime();
      nextValidation = Date.now() + HOST_AUTH_REVALIDATION_MS;
    },
  };
}
