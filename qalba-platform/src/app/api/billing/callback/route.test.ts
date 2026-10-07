import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ find: vi.fn(), reconcile: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: () => ({ purchase: { findUnique: m.find } }) }));
vi.mock("@/lib/billing/checkout", () => ({ reconcilePurchase: m.reconcile }));
import { POST } from "./route";

function request(body: BodyInit, headers: HeadersInit = {}) {
  return new NextRequest(`http://localhost/api/billing/callback?token=${"t".repeat(40)}`, { method: "POST", body, headers, duplex: "half" });
}
describe("bounded billing callback ingress", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("MOYASAR_CALLBACK_TOKEN", "t".repeat(40)); });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects an oversized declared body before database/provider lookup", async () => {
    expect((await POST(request("small", { "content-length": "16385" }))).status).toBe(413);
    expect(m.find).not.toHaveBeenCalled(); expect(m.reconcile).not.toHaveBeenCalled();
  });
  it("cancels an oversized chunked body with no Content-Length", async () => {
    let pulls = 0; const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ pull(c) { pulls++; c.enqueue(new Uint8Array(8192)); }, cancel }, { highWaterMark: 0 });
    expect((await POST(request(stream))).status).toBe(413);
    expect(pulls).toBe(3); expect(cancel).toHaveBeenCalledTimes(1); expect(m.find).not.toHaveBeenCalled();
  });
  it("keeps the existing valid callback settlement primitive", async () => {
    const id = "98aa80e8-a86b-4c32-9083-a6ecfd902ecc";
    m.find.mockResolvedValue({ id: "purchase-1" }); m.reconcile.mockResolvedValue({ status: "PAID" });
    expect((await POST(request(JSON.stringify({ id })))).status).toBe(200);
    expect(m.find).toHaveBeenCalledWith({ where: { providerReference: id } });
    expect(m.reconcile).toHaveBeenCalledExactlyOnceWith("purchase-1", undefined, "CALLBACK");
  });
  it("preserves the generic malformed-input and authorization responses", async () => {
    expect((await POST(request("invalid"))).status).toBe(503);
    expect((await POST(new NextRequest("http://localhost/api/billing/callback", { method: "POST", body: "huge" }))).status).toBe(403);
  });
});
