import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ user: vi.fn(), consume: vi.fn(), verify: vi.fn(), hash: vi.fn(), session: vi.fn(), cookie: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: () => ({ user: { findUnique: m.user } }) }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeAuthAttempt: m.consume }));
vi.mock("@/lib/auth/crypto", () => ({ hashPassword: m.hash, verifyPassword: m.verify }));
vi.mock("@/lib/auth/session", () => ({ createSession: m.session, setSessionCookie: m.cookie }));
import { POST } from "./route";
function request() { return new NextRequest("http://localhost:3000/api/auth/login", { method: "POST", headers: { origin: "http://localhost:3000" }, body: JSON.stringify({ email: "user@example.test", password: "unchanged-password" }) }); }
describe("layered login/admin boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); m.consume.mockResolvedValue(true); m.user.mockResolvedValue({ id: "u1", role: "USER", passwordHash: "stored", suspendedAt: null }); m.verify.mockResolvedValue(true); m.session.mockResolvedValue({ token: "opaque", expiresAt: new Date("2030-01-01") }); });
  it("rejects exhausted general budget before password work or lookup", async () => {
    m.consume.mockResolvedValue(false); expect((await POST(request())).status).toBe(429);
    expect(m.user).not.toHaveBeenCalled(); expect(m.verify).not.toHaveBeenCalled(); expect(m.session).not.toHaveBeenCalled();
  });
  it("applies stricter authoritative ADMIN budget before password verification", async () => {
    const req = request(); m.user.mockResolvedValue({ id: "admin", role: "ADMIN", passwordHash: "stored" });
    m.consume.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await POST(req)).status).toBe(429);
    expect(m.consume).toHaveBeenNthCalledWith(1, "user@example.test", "login", 8, req);
    expect(m.consume).toHaveBeenNthCalledWith(2, "user@example.test", "admin-login", 8, req);
    expect(m.verify).not.toHaveBeenCalled(); expect(m.session).not.toHaveBeenCalled();
  });
  it("preserves normal password verification and session/cookie creation", async () => {
    expect((await POST(request())).status).toBe(200); expect(m.verify).toHaveBeenCalledWith("unchanged-password", "stored");
    expect(m.session).toHaveBeenCalledExactlyOnceWith("u1"); expect(m.cookie).toHaveBeenCalledWith("opaque", expect.any(Date));
  });
  it("preserves suspension and unknown-account error behavior", async () => {
    m.user.mockResolvedValue({ id: "suspended", role: "USER", passwordHash: "stored", suspendedAt: new Date() });
    expect((await POST(request())).status).toBe(403); expect(m.session).not.toHaveBeenCalled();
    m.user.mockResolvedValue(null); expect((await POST(request())).status).toBe(401); expect(m.hash).toHaveBeenCalledWith("unchanged-password");
  });
});
