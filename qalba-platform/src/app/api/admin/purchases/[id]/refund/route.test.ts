import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ current: vi.fn(), confirm: vi.fn(), find: vi.fn(), events: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentUser: m.current }));
vi.mock("@/lib/billing/refunds", () => ({ confirmSupportRefund: m.confirm, refundSummary: vi.fn(r => r) }));
vi.mock("@/lib/db", () => ({ db: () => ({ purchase: { findUnique: m.find }, paymentEvent: { findMany: m.events } }) }));
import { GET, POST } from "./route";
const params = { params: Promise.resolve({ id: "purchase-1" }) };
const data = { providerReference: "c079f9ce-4882-4a37-8e16-10f9b1cc62cc", paymentReference: "3645d8ed-dcd9-4b5d-acd7-48f2b32b1e63" };
function request(body = data, origin = "http://localhost") { return new NextRequest("http://localhost/api/admin/purchases/purchase-1/refund", { method: "POST", headers: { origin }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("APP_URL", "http://localhost"); }); afterEach(() => vi.unstubAllEnvs());
it.each([null, { id: "u", role: "USER" }])("denies non-admin POST and GET", async user => { m.current.mockResolvedValue(user); expect((await POST(request(), params)).status).toBe(403); expect((await GET(request(), params)).status).toBe(403); expect(m.confirm).not.toHaveBeenCalled(); expect(m.find).not.toHaveBeenCalled(); });
it("requires same origin before authorization/provider work", async () => { expect((await POST(request(data, "https://attacker.invalid"), params)).status).toBe(403); expect(m.current).not.toHaveBeenCalled(); expect(m.confirm).not.toHaveBeenCalled(); });
it.each([{ ...data, delta: -100 }, { ...data, amount: 100 }, { ...data, userId: "victim" }, { ...data, paymentReference: "invalid" }])("rejects arbitrary adjustment or malformed reference", async body => { m.current.mockResolvedValue({ id: "a", role: "ADMIN" }); expect((await POST(request(body), params)).status).toBe(400); expect(m.confirm).not.toHaveBeenCalled(); });
it("passes only fixed purchase/ref references and authenticated operator", async () => { m.current.mockResolvedValue({ id: "a", role: "ADMIN" }); m.confirm.mockResolvedValue({ state: "REFUNDED", unresolvedCredits: 2, supportStatus: "SUPPORT_REQUIRED" }); const response = await POST(request(), params); expect(response.status).toBe(200); expect(m.confirm).toHaveBeenCalledExactlyOnceWith("purchase-1", data.providerReference, data.paymentReference, "a"); expect(await response.json()).toMatchObject({ unresolvedCredits: 2 }); });
it("unknown purchase is a deterministic 404 read", async () => { m.current.mockResolvedValue({ id: "a", role: "ADMIN" }); m.find.mockResolvedValue(null); expect((await GET(request(), params)).status).toBe(404); });
