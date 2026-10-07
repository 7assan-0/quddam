import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { partySlugs } from "@/lib/games/party/types";
const m = vi.hoisted(() => ({ user: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentUser: m.user }));
vi.mock("@/lib/games/party/service", () => ({ createPartySession: m.create }));
import { POST } from "./route";

function request(body: BodyInit = JSON.stringify({ teamNames: ["فريق ألف", "فريق باء"], playerNames: [], timerSeconds: 30 }), origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/games/party/bluff", { method: "POST", headers: { origin }, body, duplex: "half" });
}
describe("new generic legacy creation boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("APP_URL", "http://localhost:3000"); m.user.mockResolvedValue({ id: "host" }); });
  it.each(partySlugs)("rejects %s without calling creation or redirecting to a replacement", async slug => {
    const response = await POST(request(), { params: Promise.resolve({ slug }) });
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "اللعبة غير متاحة" });
    expect(response.headers.get("location")).toBeNull(); expect(m.create).not.toHaveBeenCalled();
  });
  it("retains safe unknown-slug validation", async () => {
    expect((await POST(request(), { params: Promise.resolve({ slug: "unknown-game" }) })).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("preserves authentication and origin checks", async () => {
    m.user.mockResolvedValue(null);
    expect((await POST(request(), { params: Promise.resolve({ slug: "bluff" }) })).status).toBe(403);
    m.user.mockResolvedValue({ id: "host" });
    expect((await POST(request("{}", "http://attacker.test"), { params: Promise.resolve({ slug: "bluff" }) })).status).toBe(403);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("rejects a stale client before reading its body", async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(100_000)); } }, { highWaterMark: 0 });
    expect((await POST(request(body), { params: Promise.resolve({ slug: "party-court" }) })).status).toBe(404);
    expect(pulls).toBe(0); expect(m.create).not.toHaveBeenCalled();
    await body.cancel();
  });
});
