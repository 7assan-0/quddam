import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: () => ({ authSession: { findUnique: lookup } }) }));
import { createHostSessionGuard, HostAuthInvalidError, HostAuthTransientError, validateActiveAuthSession } from "./host-stream";
const now = new Date("2026-10-05T12:00:00Z");
const row = () => ({ userId: "host", revokedAt: null, expiresAt: new Date(now.getTime() + 120_000), user: { id: "host", suspendedAt: null } });
const binding = () => ({ sessionId: "original-session", user: { id: "host" }, expiresAt: row().expiresAt });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); lookup.mockReset().mockResolvedValue(row()); });
afterEach(() => vi.useRealTimers());
describe("exact Host AuthSession validation", () => {
  it("queries the exact original session and checks its account", async () => {
    expect(await validateActiveAuthSession("original-session", "host")).toEqual({ status: "ACTIVE", expiresAt: row().expiresAt });
    expect(lookup.mock.calls[0][0].where).toEqual({ id: "original-session" });
    expect(lookup.mock.calls[0][0].select.user.select.suspendedAt).toBe(true);
  });
  it.each([
    ["missing/deleted session", () => null],
    ["logout or explicit revocation", () => ({ ...row(), revokedAt: now })],
    ["password-reset invalidation", () => ({ ...row(), revokedAt: now })],
    ["expired session", () => ({ ...row(), expiresAt: now })],
    ["wrong session owner", () => ({ ...row(), userId: "other" })],
    ["wrong account identity", () => ({ ...row(), user: { id: "other", suspendedAt: null } })],
    ["suspended account", () => ({ ...row(), user: { id: "host", suspendedAt: now } })],
  ])("rejects %s", async (_label, value) => {
    lookup.mockResolvedValue(value());
    expect(await validateActiveAuthSession("original-session", "host")).toEqual({ status: "AUTH_INVALID" });
  });
  it("classifies lookup errors as transient and never writes auth state", async () => {
    lookup.mockRejectedValue(new Error("temporary network failure"));
    expect(await validateActiveAuthSession("original-session", "host")).toEqual({ status: "TRANSIENT_FAILURE" });
  });
});
describe("bounded per-stream guard", () => {
  it("performs three lookups per minute even with two checks every 250ms", async () => {
    const guard = createHostSessionGuard(binding());
    for (let ms = 0; ms <= 60_000; ms += 250) {
      vi.setSystemTime(now.getTime() + ms); await guard.assertActive(); await guard.assertActive();
    }
    expect(lookup).toHaveBeenCalledTimes(3);
    expect(lookup.mock.calls.every(([input]) => input.where.id === "original-session")).toBe(true);
  });
  it("stops at the first revoked boundary and stays invalid if a different login is valid", async () => {
    const guard = createHostSessionGuard(binding());
    await guard.assertActive(); lookup.mockResolvedValue({ ...row(), revokedAt: now });
    vi.setSystemTime(now.getTime() + 19_999); await guard.assertActive(); expect(lookup).not.toHaveBeenCalled();
    vi.setSystemTime(now.getTime() + 20_000); await expect(guard.assertActive()).rejects.toBeInstanceOf(HostAuthInvalidError);
    lookup.mockResolvedValue(row()); await expect(guard.assertActive()).rejects.toBeInstanceOf(HostAuthInvalidError);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
  it("uses captured expiry without waiting for a later cadence tick", async () => {
    const guard = createHostSessionGuard({ ...binding(), expiresAt: new Date(now.getTime() + 500) });
    vi.setSystemTime(now.getTime() + 500); await expect(guard.assertActive()).rejects.toBeInstanceOf(HostAuthInvalidError);
    expect(lookup).not.toHaveBeenCalled();
  });
  it("a transient failure does not latch revocation", async () => {
    const guard = createHostSessionGuard(binding()); vi.setSystemTime(now.getTime() + 20_000);
    lookup.mockRejectedValueOnce(new Error("temporary DB failure"));
    await expect(guard.assertActive()).rejects.toBeInstanceOf(HostAuthTransientError);
    await expect(guard.assertActive()).resolves.toBeUndefined();
  });
  it("observes a shortened server expiry on revalidation", async () => {
    const guard = createHostSessionGuard(binding()); lookup.mockResolvedValue({ ...row(), expiresAt: new Date(now.getTime()+21_000) });
    vi.setSystemTime(now.getTime()+20_000); await guard.assertActive();
    vi.setSystemTime(now.getTime()+21_000); await expect(guard.assertActive()).rejects.toBeInstanceOf(HostAuthInvalidError);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});
