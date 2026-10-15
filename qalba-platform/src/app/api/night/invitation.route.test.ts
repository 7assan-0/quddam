import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  user: vi.fn(), create: vi.fn(), owner: vi.fn(), publicGet: vi.fn(), respond: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ currentUser: m.user }));
vi.mock("@/lib/night/invitation-service", () => ({
  createInvitation: m.create, ownerInvitation: m.owner,
  getPublicInvitation: m.publicGet, respondToInvitation: m.respond,
}));
import { POST as ownerPost, GET as ownerGet } from "./[id]/invitation/route";
import { POST as guestPost, GET as guestGet } from "./invite/[code]/route";

const ownerContext = { params: Promise.resolve({ id: "night-1" }) };
const guestContext = { params: Promise.resolve({ code: "a".repeat(64) }) };
const schedule = { scheduledAt: "2026-11-01T18:00:00.000+03:00", timezone: "Asia/Riyadh" };
const vote = { name: "نواف", rsvp: "YES", gameVote: "top-list" };
function request(path: string, method: "GET" | "POST", body?: unknown, origin = "http://localhost:3000", cookie?: string) {
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
});
