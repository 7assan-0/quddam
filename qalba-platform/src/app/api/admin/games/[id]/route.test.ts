import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { LAUNCH_GAME_SLUGS } from "@/lib/games/launch-policy";
const m = vi.hoisted(() => ({ user: vi.fn(), find: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentUser: m.user }));
vi.mock("@/lib/db", () => ({ db: () => ({ gameType: { findUnique: m.find, update: m.update } }) }));
import { PATCH } from "./route";
const context = { params: Promise.resolve({ id: "game" }) };
function request(enabled: boolean) { return new NextRequest("http://localhost:3000/api/admin/games/game", { method: "PATCH", headers: { origin: "http://localhost:3000" }, body: JSON.stringify({ enabled }) }); }
describe("availability is separate from launch eligibility", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("APP_URL", "http://localhost:3000"); m.user.mockResolvedValue({ role: "ADMIN" }); m.update.mockResolvedValue({ enabled: true }); });
  it.each(LAUNCH_GAME_SLUGS)("allows normal availability enablement for official %s", async slug => {
    m.find.mockResolvedValue({ slug }); expect((await PATCH(request(true), context)).status).toBe(200);
    expect(m.update).toHaveBeenCalledWith({ where: { id: "game" }, data: { enabled: true } });
  });
  it.each(["letter-battle", "fastest-mind", "party-court", "unknown-game"])("cannot launch-enable %s", async slug => {
    m.find.mockResolvedValue({ slug }); const response = await PATCH(request(true), context);
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: "اللعبة ليست ضمن ألعاب الإطلاق" }); expect(m.update).not.toHaveBeenCalled();
  });
  it("allows disabling a legacy row without deleting it", async () => {
    m.find.mockResolvedValue({ slug: "party-court" }); expect((await PATCH(request(false), context)).status).toBe(200);
    expect(m.update).toHaveBeenCalledWith({ where: { id: "game" }, data: { enabled: false } });
  });
  it("keeps admin authorization", async () => {
    m.user.mockResolvedValue({ role: "USER" }); expect((await PATCH(request(true), context)).status).toBe(403); expect(m.update).not.toHaveBeenCalled();
  });
  it("keeps the missing-game response", async () => { m.find.mockResolvedValue(null); expect((await PATCH(request(true), context)).status).toBe(404); expect(m.update).not.toHaveBeenCalled(); });
});
