import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ consume: vi.fn(), hash: vi.fn(), transaction: vi.fn(), use: vi.fn(), find: vi.fn(), user: vi.fn(), sessions: vi.fn() }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeAuthAttempt: m.consume }));
vi.mock("@/lib/auth/crypto", () => ({ hashPassword: m.hash, tokenHash: () => "hashed-token" }));
vi.mock("@/lib/db", () => ({ db: () => ({ $transaction: m.transaction }) }));
import { POST } from "./route";
function request() { return new NextRequest("http://localhost:3000/api/auth/reset", { method: "POST", headers: { origin: "http://localhost:3000" }, body: JSON.stringify({ token: "t".repeat(40), password: "new-safe-password-123" }) }); }
describe("reset submission resource bound", () => {
  beforeEach(() => { vi.clearAllMocks(); m.consume.mockResolvedValue(true); m.hash.mockResolvedValue("new-hash"); m.use.mockResolvedValue({ count: 1 }); m.find.mockResolvedValue({ userId: "u1" });
    m.transaction.mockImplementation((run: (tx: unknown) => unknown) => run({ passwordReset: { updateMany: m.use, findUniqueOrThrow: m.find }, user: { update: m.user }, authSession: { updateMany: m.sessions } })); });
  it("rejects exhausted budget before hashing or reset/session mutation", async () => {
    m.consume.mockResolvedValue(false); expect((await POST(request())).status).toBe(429);
    expect(m.hash).not.toHaveBeenCalled(); expect(m.transaction).not.toHaveBeenCalled(); expect(m.sessions).not.toHaveBeenCalled();
  });
  it("preserves one-use reset and existing all-session invalidation semantics", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(m.user).toHaveBeenCalledWith({ where: { id: "u1" }, data: { passwordHash: "new-hash" } });
    expect(m.sessions).toHaveBeenCalledWith({ where: { userId: "u1", revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    m.use.mockResolvedValue({ count: 0 }); expect((await POST(request())).status).toBe(400); expect(m.sessions).toHaveBeenCalledTimes(1);
  });
});
