import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => {
  class ServiceError extends Error {
    constructor(message: string, readonly status: number, readonly code: string) { super(message); }
  }
  return { user: vi.fn(), create: vi.fn(), get: vi.fn(), command: vi.fn(), ServiceError };
});
vi.mock("@/lib/auth/session", () => ({ currentUser: m.user }));
vi.mock("@/lib/night/service", () => ({
  createNightSession: m.create, getNightView: m.get, applyNightCommand: m.command, NightServiceError: m.ServiceError,
}));
import { POST as create } from "./route";
import { GET as read } from "./[id]/route";
import { POST as command } from "./[id]/commands/route";

const key = "00000000-0000-4000-8000-000000000001";
const payload = { key, games: ["top-list", "ordering-challenge", "survey-show"], teams: ["الفريق الأول", "الفريق الثاني"] };
const action = { key, expectedVersion: 0, op: "START" };
const context = { params: Promise.resolve({ id: "night-1" }) };
const request = (body: unknown = payload, origin = "http://localhost:3000", path = "/api/night") =>
  new NextRequest(`http://localhost:3000${path}`, { method: "POST",
    headers: { origin, host: "localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true"); vi.stubEnv("APP_URL", "http://localhost:3000");
  m.user.mockResolvedValue({ id: "authenticated-owner" });
  m.create.mockResolvedValue({ id: "night-1", phase: "preparing" });
  m.get.mockResolvedValue({ id: "night-1", phase: "playing" });
  m.command.mockResolvedValue({ id: "night-1", phase: "playing" });
});
afterEach(() => vi.unstubAllEnvs());

// HTTP boundary coverage only. PostgreSQL/Chrome separately exercise real games.
describe("Night authenticated, disabled-by-default HTTP boundary", () => {
  it("does not touch authentication, storage or request streams while disabled", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "false");
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({ pull(c) { pulls++; c.enqueue(new Uint8Array(5_000)); } }, { highWaterMark: 0 });
    const req = new NextRequest("http://localhost:3000/api/night", { method: "POST", body, duplex: "half" });
    expect((await create(req)).status).toBe(404);
    expect((await read(request(), context)).status).toBe(404);
    expect((await command(request(action), context)).status).toBe(404);
    expect(pulls).toBe(0); expect(m.user).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled(); expect(m.get).not.toHaveBeenCalled(); expect(m.command).not.toHaveBeenCalled();
    await body.cancel();
  });
  it("rejects unauthenticated reads and writes", async () => {
    m.user.mockResolvedValue(null);
    for (const response of [await create(request()), await read(request(), context), await command(request(action), context)]) {
      expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(m.create).not.toHaveBeenCalled(); expect(m.get).not.toHaveBeenCalled(); expect(m.command).not.toHaveBeenCalled();
  });
  it("denies cross-origin writes before authenticating or executing commands", async () => {
    expect((await create(request(payload, "https://attacker.invalid"))).status).toBe(403);
    expect((await command(request(action, "https://attacker.invalid"), context)).status).toBe(403);
    expect(m.user).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled(); expect(m.command).not.toHaveBeenCalled();
  });
  it("binds ownership exclusively to the authenticated account and returns private responses", async () => {
    const response = await create(request());
    expect(response.status).toBe(201); expect(await response.json()).toEqual({ night: { id: "night-1", phase: "preparing" } });
    expect(m.create).toHaveBeenCalledWith("authenticated-owner", payload);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    await read(request(), context); expect(m.get).toHaveBeenCalledWith("authenticated-owner", "night-1");
    await command(request(action), context); expect(m.command).toHaveBeenCalledWith("authenticated-owner", "night-1", action);
  });
  it.each(["ownerId", "hostId", "points", "results", "sourceSessionId", "placements"])("refuses browser-supplied %s", async field => {
    expect((await create(request({ ...payload, [field]: "forged" }))).status).toBe(400);
    expect((await command(request({ ...action, [field]: "forged" }), context)).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled(); expect(m.command).not.toHaveBeenCalled();
  });
  it.each(["legacy-party", "the-court", "not-official"])("rejects unsupported %s before creation", async game => {
    expect((await create(request({ ...payload, games: [game, ...payload.games.slice(1)] }))).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON, incorrect types and oversized streamed bytes", async () => {
    const malformed = new NextRequest("http://localhost:3000/api/night", { method: "POST", headers: { origin: "http://localhost:3000" }, body: "{" });
    expect((await create(malformed)).status).toBe(400);
    expect((await command(request({ ...action, expectedVersion: "0" }), context)).status).toBe(400);
    expect((await create(request({ ...payload, teams: ["a", "b"] }))).status).toBe(400);
    expect((await create(request({ ...payload, teams: ["أ".repeat(3_000), "الفريق الثاني"] }))).status).toBe(413);
    expect(m.create).not.toHaveBeenCalled(); expect(m.command).not.toHaveBeenCalled();
  });
  it("does not pass malformed identifiers to storage", async () => {
    const bad = { params: Promise.resolve({ id: "../other-session" }) };
    expect((await read(request(), bad)).status).toBe(400);
    expect((await command(request(action), bad)).status).toBe(400);
    expect(m.get).not.toHaveBeenCalled(); expect(m.command).not.toHaveBeenCalled();
  });
  it("returns authorized domain refusals without echoing unexpected exception contents", async () => {
    m.get.mockRejectedValueOnce(new m.ServiceError("غير مصرح بهذه السهرة", 403, "NIGHT_FORBIDDEN"));
    const denied = await read(request(), context); expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: "غير مصرح بهذه السهرة", code: "NIGHT_FORBIDDEN" });
    m.command.mockRejectedValueOnce(new Error("PRIVATE_DATABASE_DETAILS_MUST_NOT_APPEAR"));
    const failed = await command(request(action), context);
    expect(failed.status).toBe(500); expect(await failed.text()).not.toContain("PRIVATE_DATABASE_DETAILS");
  });
});
