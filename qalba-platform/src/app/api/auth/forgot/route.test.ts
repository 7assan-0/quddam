import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ configured: vi.fn(), consume: vi.fn(), user: vi.fn(), create: vi.fn(), remove: vi.fn(), mail: vi.fn() }));
vi.mock("@/lib/auth/mail", () => ({ mailConfigured: m.configured, sendResetMail: m.mail }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeAuthAttempt: m.consume }));
vi.mock("@/lib/db", () => ({ db: () => ({ user: { findUnique: m.user }, passwordReset: { create: m.create, delete: m.remove } }) }));
import { POST } from "./route";
function request() { return new NextRequest("http://localhost:3000/api/auth/forgot", { method: "POST", headers: { origin: "http://localhost:3000" }, body: JSON.stringify({ email: "user@example.test" }) }); }
describe("password recovery abuse boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); m.configured.mockReturnValue(true); m.consume.mockResolvedValue(true); m.user.mockResolvedValue({ id: "u1" }); m.create.mockResolvedValue({ id: "reset-1" }); m.mail.mockResolvedValue(undefined); });
  it("denies an exhausted budget without enumeration, token issuance or mail", async () => {
    m.consume.mockResolvedValue(false); const response = await POST(request());
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true });
    expect(m.user).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled(); expect(m.mail).not.toHaveBeenCalled();
  });
  it("preserves a legitimate one-use hashed reset token and mail flow", async () => {
    const req = request(); expect((await POST(req)).status).toBe(200);
    expect(m.consume).toHaveBeenCalledWith("user@example.test", "forgot", 8, req);
    expect(m.create).toHaveBeenCalledWith({ data: { userId: "u1", tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/), expiresAt: expect.any(Date) } });
    expect(m.mail).toHaveBeenCalledTimes(1);
  });
  it("keeps unavailable SMTP explicit and removes an unsent reset token", async () => {
    m.configured.mockReturnValue(false); expect((await POST(request())).status).toBe(503); expect(m.consume).not.toHaveBeenCalled();
    m.configured.mockReturnValue(true); m.mail.mockRejectedValue(new Error("test SMTP unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect((await POST(request())).status).toBe(500); expect(m.remove).toHaveBeenCalledWith({ where: { id: "reset-1" } }); }
    finally { log.mockRestore(); }
  });
});
