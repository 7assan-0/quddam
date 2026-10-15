import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { NIGHT_GAMES } from "@/lib/night/catalog";
import type { NightView } from "@/lib/night/types";

const m = vi.hoisted(() => ({ user: vi.fn(), view: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentUser: m.user }));
vi.mock("@/lib/night/service", () => ({ getNightView: m.view, NightServiceError: class extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
} }));
import { GET } from "./route";
import { NightServiceError } from "@/lib/night/service";
function fixture(): NightView {
  const teams = [{ id: "private-a", name: "فريق ألف" }, { id: "private-b", name: "فريق باء" }];
  return { id: "night", phase: "ended", version: 2, teams,
    games: NIGHT_GAMES.map((game, position) => ({ ...game, position, imported: position === 0, hostHref: null, sourceStatus: null })),
    currentIndex: 0, current: null, importReady: false, blockedReason: null, canNext: false,
    results: [{ game: "top-list", sourceSessionId: "private-source", placements: teams.map(team => ({ teamIds: [team.id] })), points: { "private-a": 3, "private-b": 2 } }],
    totals: { "private-a": 3, "private-b": 2 }, ranking: teams.map((team, i) => ({ ...team, points: 3 - i })), winnerIds: [] };
}
const request = () => new NextRequest("http://localhost:3000/api/night/night/highlights");
const context = { params: Promise.resolve({ id: "night" }) };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true");
  m.user.mockResolvedValue({ id: "owner" }); m.view.mockResolvedValue(fixture());
});
afterEach(() => vi.unstubAllEnvs());
describe("private derived Night highlights HTTP boundary", () => {
  it("exposes only accepted-result facts and names with private cache headers", async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(m.view).toHaveBeenCalledExactlyOnceWith("owner", "night");
    const body = await response.text();
    expect(body).toContain("فريق ألف"); expect(body).toContain("سهرة غير مكتملة");
    expect(body).not.toContain("private-"); expect(body).not.toContain("بطل الليلة:");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("rejects feature-off before authentication or storage access", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "false");
    expect((await GET(request(), context)).status).toBe(404);
    expect(m.user).not.toHaveBeenCalled(); expect(m.view).not.toHaveBeenCalled();
  });
  it("rejects missing login and another owner without exposing results", async () => {
    m.user.mockResolvedValueOnce(null);
    expect((await GET(request(), context)).status).toBe(401);
    expect(m.view).not.toHaveBeenCalled();
    m.view.mockRejectedValueOnce(new NightServiceError("الليلة غير موجودة", 404, "NOT_FOUND"));
    const response = await GET(request(), context);
    expect(response.status).toBe(404); expect(await response.text()).not.toContain("فريق ألف");
  });
  it.each(["preparing", "playing"] as const)("refuses highlights before ending (%s)", async phase => {
    m.view.mockResolvedValue({ ...fixture(), phase });
    expect((await GET(request(), context)).status).toBe(409);
  });
  it("sanitizes unexpected storage exceptions", async () => {
    m.view.mockRejectedValueOnce(new Error("postgresql://private:secret@db.example/private"));
    const response = await GET(request(), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/postgresql|secret|db\.example/);
  });
});
