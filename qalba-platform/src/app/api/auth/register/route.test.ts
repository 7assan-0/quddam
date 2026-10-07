import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), create: vi.fn(), consume: vi.fn(), createSession: vi.fn(), setCookie: vi.fn(), welcome: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: () => ({ user: { findUnique: mocks.findUnique },
  $transaction: (callback: (tx: unknown) => unknown) => callback({ user: { create: mocks.create } }) }) }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeAuthAttempt: mocks.consume }));
vi.mock("@/lib/auth/session", () => ({ createSession: mocks.createSession, setSessionCookie: mocks.setCookie }));
vi.mock("@/lib/billing/credits", () => ({ ensureWelcomeCredits: mocks.welcome, CreditError: class CreditError extends Error {} }));
vi.mock("@/lib/analytics/events", () => ({ recordEvent: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "./route";

const payload = { name: "حسان", email: "person@example.com", password: "a-strong-password-123" };
function request(origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/auth/register", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(payload) });
}

describe("registration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consume.mockResolvedValue(true);
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "user-1" });
    mocks.welcome.mockResolvedValue({ balance: 3 });
    mocks.createSession.mockResolvedValue({ token: "opaque", expiresAt: new Date("2030-01-01") });
  });

  it("rejects cross-origin writes before touching storage", async () => {
    const response = await POST(request("https://attacker.example"));
    expect(response.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rejects duplicate emails without creating a session", async () => {
    mocks.findUnique.mockResolvedValue({ id: "existing" });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("creates a regular account and issues an opaque session", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: payload.email, wallet: { create: { balance: 0 } } }) }));
    expect(mocks.welcome).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(mocks.setCookie).toHaveBeenCalledWith("opaque", expect.any(Date));
  });
});
