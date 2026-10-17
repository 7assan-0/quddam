import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  user: vi.fn(), create: vi.fn(), owner: vi.fn(), revoke: vi.fn(), publicGet: vi.fn(), respond: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ currentUser: m.user }));
vi.mock("@/lib/night/invitation-service", () => ({
  createInvitation: m.create, ownerInvitation: m.owner, revokeInvitation: m.revoke,
  getPublicInvitation: m.publicGet, respondToInvitation: m.respond,
}));
import { POST as ownerPost, GET as ownerGet, DELETE as ownerDelete } from "./[id]/invitation/route";
import { POST as guestPost, GET as guestGet } from "./invite/[code]/route";

const ownerContext = { params: Promise.resolve({ id: "night-1" }) };
const guestContext = { params: Promise.resolve({ code: "a".repeat(64) }) };
const schedule = { scheduledAt: "2026-11-01T18:00:00.000+03:00", timezone: "Asia/Riyadh" };
const vote = { name: "نواف", rsvp: "YES", gameVote: "top-list" };
function request(path: string, method: "GET" | "POST" | "DELETE", body?: unknown, origin = "http://localhost:3000", cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method, headers: { origin, host: "localhost:3000", ...(cookie ? { cookie } : {}),
      ...(method === "POST" ? { "content-type": "application/json" } : {}) },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}
const ownerPath = "/api/night/night-1/invitation", guestPath = `/api/night/invite/${"a".repeat(64)}`;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  m.user.mockResolvedValue({ id: "owner-1" });
  m.create.mockResolvedValue({ path: `/night/invite/${"a".repeat(64)}`, scheduledAt: "2026-11-01T15:00:00.000Z",
    timezone: "Asia/Riyadh" });
  m.owner.mockResolvedValue({ exists: false });
  m.revoke.mockResolvedValue({ revoked: true });
  m.publicGet.mockResolvedValue({ id: "invite-1", expiresAt: new Date("2026-11-02T15:00:00.000Z"), cookieName: "quddam_night_rsvp_invite-1",
    view: { open: true, games: [{ game: "top-list", votes: 0 }], coming: 0, declined: 0, mine: null } });
  m.respond.mockResolvedValue({ cookieName: "quddam_night_rsvp_invite-1", cookieValue: "b".repeat(64),
    expiresAt: new Date("2026-11-02T15:00:00.000Z"),
    view: { open: true, coming: 1, declined: 0, mine: { name: "نواف", rsvp: "YES", gameVote: "top-list" } } });
});
afterEach(() => vi.unstubAllEnvs());
describe("planning-only Night HTTP boundaries", () => {
  it("returns 404 before authentication or invite lookups when feature disabled", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "false");
    expect((await ownerPost(request(ownerPath, "POST", schedule), ownerContext)).status).toBe(404);
    expect((await ownerGet(request(ownerPath, "GET"), ownerContext)).status).toBe(404);
    expect((await guestGet(request(guestPath, "GET"), guestContext)).status).toBe(404);
    expect((await guestPost(request(guestPath, "POST", vote), guestContext)).status).toBe(404);
    expect(m.user).not.toHaveBeenCalled();
    expect(m.publicGet).not.toHaveBeenCalled();
  });
  it("owner creation is private, authenticated, same-origin and strict", async () => {
    m.user.mockResolvedValueOnce(null);
    expect((await ownerPost(request(ownerPath, "POST", schedule), ownerContext)).status).toBe(401);
    expect((await ownerPost(request(ownerPath, "POST", schedule, "https://other.invalid"), ownerContext)).status).toBe(403);
    expect((await ownerPost(request(ownerPath, "POST", { ...schedule, wallet: 100 }), ownerContext)).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
    const ok = await ownerPost(request(ownerPath, "POST", schedule), ownerContext);
    expect(ok.status).toBe(201);
    expect(ok.headers.get("cache-control")).toBe("private, no-store");
    expect(ok.headers.get("referrer-policy")).toBe("no-referrer");
    expect(m.create).toHaveBeenCalledWith("owner-1", "night-1", schedule);
    expect((await ownerGet(request(ownerPath, "GET"), ownerContext)).status).toBe(200);
    expect(m.owner).toHaveBeenCalledWith("owner-1", "night-1");
  });
  it("DELETE is feature-gated, same-origin, authenticated and private without a body", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "false");
    expect((await ownerDelete(request(ownerPath, "DELETE"), ownerContext)).status).toBe(404);
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true");
    expect((await ownerDelete(request(ownerPath, "DELETE", undefined, "https://other.invalid"), ownerContext)).status).toBe(403);
    m.user.mockResolvedValueOnce(null);
    expect((await ownerDelete(request(ownerPath, "DELETE"), ownerContext)).status).toBe(401);
    expect(m.revoke).not.toHaveBeenCalled();
    const deleted = await ownerDelete(request(ownerPath, "DELETE"), ownerContext);
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ revoked: true });
    expect(deleted.headers.get("cache-control")).toBe("private, no-store");
    expect(deleted.headers.get("referrer-policy")).toBe("no-referrer");
    expect(m.revoke).toHaveBeenCalledTimes(1);
    expect(m.revoke).toHaveBeenCalledWith("owner-1", "night-1");
  });
  it("public link shows aggregate planning data only; same-origin is required to mutate", async () => {
    const read = await guestGet(request(guestPath, "GET"), guestContext);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({ invitation: { open: true, games: [{ game: "top-list", votes: 0 }],
      coming: 0, declined: 0, mine: null } });
    expect(read.headers.get("referrer-policy")).toBe("no-referrer");
    expect(read.headers.get("set-cookie")).toContain("HttpOnly"); // Capability pre-issued on GET.
    expect((await guestPost(request(guestPath, "POST", vote, "https://other.invalid"), guestContext)).status).toBe(403);
    expect(m.respond).not.toHaveBeenCalled();
  });
  it("rejects malformed/extra RSVP values and never passes them to the service", async () => {
    expect((await guestPost(request(guestPath, "POST", { ...vote, role: "host" }), guestContext)).status).toBe(400);
    expect((await guestPost(request(guestPath, "POST", { ...vote, gameVote: "out-of-the-loop" }), guestContext)).status).toBe(400);
    expect((await guestPost(request(guestPath, "POST", { ...vote, rsvp: "MAYBE" }), guestContext)).status).toBe(400);
    expect(m.respond).not.toHaveBeenCalled();
  });
  it("returns an HttpOnly participant cookie and passes it on future updates", async () => {
    const response = await guestPost(request(guestPath, "POST", vote), guestContext);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(m.respond).toHaveBeenCalledWith("a".repeat(64), vote, undefined);
    m.publicGet.mockResolvedValue({ id: "invite-1", cookieName: "quddam_night_rsvp_invite-1", view: {} });
    await guestPost(request(guestPath, "POST", vote, "http://localhost:3000",
      `quddam_night_rsvp_invite-1=${"b".repeat(64)}`), guestContext);
    expect(m.respond).toHaveBeenLastCalledWith("a".repeat(64), vote, "b".repeat(64));
  });
  it("limits RSVP capabilities to this invitation API path instead of sending them to games", async () => {
    const bootstrap = await guestGet(request(guestPath, "GET"), guestContext);
    const saved = await guestPost(request(guestPath, "POST", vote), guestContext);
    for (const response of [bootstrap, saved]) {
      expect(response.cookies.get("quddam_night_rsvp_invite-1")?.path).toBe(guestPath);
      expect(response.headers.get("set-cookie")).toContain("HttpOnly");
      expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    }
  });
  it("keeps a preissued capability across refresh and retry after a lost first POST reply", async () => {
    const cookie = `quddam_night_rsvp_invite-1=${"b".repeat(64)}`;
    const bootstrap = await guestGet(request(guestPath, "GET", undefined, undefined, cookie), guestContext);
    expect(bootstrap.headers.get("set-cookie")).toBeNull();
    expect(m.publicGet).toHaveBeenLastCalledWith("a".repeat(64), "b".repeat(64));
    await guestPost(request(guestPath, "POST", vote, undefined, cookie), guestContext);
    await guestPost(request(guestPath, "POST", vote, undefined, cookie), guestContext);
    expect(m.respond.mock.calls).toEqual([
      ["a".repeat(64), vote, "b".repeat(64)],
      ["a".repeat(64), vote, "b".repeat(64)],
    ]);
  });
  it("keeps an accepted uppercase bearer API path and its capability cookie path consistent", async () => {
    const code = "A".repeat(64);
    const path = `/api/night/invite/${code}`;
    const context = { params: Promise.resolve({ code }) };
    const response = await guestGet(request(path, "GET"), context);
    expect(response.cookies.get("quddam_night_rsvp_invite-1")?.path).toBe(path);
    expect(m.publicGet).toHaveBeenCalledWith(code);
    await guestPost(request(path, "POST", vote, undefined, `quddam_night_rsvp_invite-1=${"B".repeat(64)}`), context);
    expect(m.respond).toHaveBeenLastCalledWith(code, vote, "b".repeat(64));
  });
  it("marks participant capabilities Secure in production and never issues one for a closed invitation", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await guestGet(request(guestPath, "GET"), guestContext);
    expect(response.cookies.get("quddam_night_rsvp_invite-1")?.secure).toBe(true);
    m.publicGet.mockResolvedValue({ cookieName: "quddam_night_rsvp_invite-1", view: { open: false } });
    expect((await guestGet(request(guestPath, "GET"), guestContext)).headers.get("set-cookie")).toBeNull();
  });
  it("rejects an oversized or malformed POST before querying invitation storage", async () => {
    const oversized = request(guestPath, "POST", { ...vote, name: "م".repeat(3_000) });
    expect((await guestPost(oversized, guestContext)).status).toBe(413);
    expect((await guestPost(request(guestPath, "POST", []), guestContext)).status).toBe(400);
    expect(m.publicGet).not.toHaveBeenCalled();
    expect(m.respond).not.toHaveBeenCalled();
  });
  it("rejects malformed bearer paths before any storage call", async () => {
    const badContext = { params: Promise.resolve({ code: "not-a-capability" }) };
    expect((await guestGet(request(guestPath, "GET"), badContext)).status).toBe(404);
    expect((await guestPost(request(guestPath, "POST", vote), badContext)).status).toBe(404);
    expect(m.publicGet).not.toHaveBeenCalled();
    expect(m.respond).not.toHaveBeenCalled();
  });
  it("sanitizes unexpected database failures and keeps error responses private", async () => {
    m.publicGet.mockRejectedValue(new Error("postgres://private:secret@private-db/name?token=private"));
    const failed = await guestGet(request(guestPath, "GET"), guestContext);
    expect(failed.status).toBe(500);
    expect(failed.headers.get("cache-control")).toBe("private, no-store");
    expect(failed.headers.get("referrer-policy")).toBe("no-referrer");
    expect(failed.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await failed.text()).not.toMatch(/postgres|secret|private-db|token=/);
    expect(failed.headers.get("set-cookie")).toBeNull();
  });
});
