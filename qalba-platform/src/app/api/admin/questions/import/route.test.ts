import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ user: vi.fn(), games: vi.fn(), categories: vi.fn(), questions: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentUser: m.user }));
vi.mock("@/lib/db", () => ({ db: () => ({ gameType: { findMany: m.games }, category: { findMany: m.categories },
  $transaction: (run: (tx: unknown) => unknown) => run({ question: { findMany: m.questions, createMany: m.create } }) }) }));
import { toCsv, columns } from "@/lib/admin/csv";
import { POST } from "./route";
function request(body: BodyInit, headers: HeadersInit = {}) {
  return new NextRequest("http://localhost:3000/api/admin/questions/import", { method: "POST", body, headers: { origin: "http://localhost:3000", ...headers }, duplex: "half" });
}
function csv() {
  return toCsv([Array.from(columns), ...Array.from({ length: 250 }, (_, i) => ["category-board", "general", `سؤال قدّام ${i}؟ ${"ق".repeat(700)}`, "جواب", "", "", "EASY", 200, "TEXT", "", "", "DRAFT", "ar", "", "", ""])]);
}
describe("bounded admin question import", () => {
  beforeEach(() => { vi.clearAllMocks(); m.user.mockResolvedValue({ role: "ADMIN" });
    m.games.mockResolvedValue([{ id: "game", slug: "category-board" }]); m.categories.mockResolvedValue([{ id: "cat", slug: "general" }]);
    m.questions.mockResolvedValue([]); m.create.mockResolvedValue({ count: 250 }); });
  it("imports a large allowed Arabic CSV using the real validator and unchanged row limit", async () => {
    const body = JSON.stringify({ csv: csv(), dryRun: false });
    expect(new TextEncoder().encode(body).length).toBeGreaterThan(350_000);
    expect(new TextEncoder().encode(body).length).toBeLessThan(550_000);
    const response = await POST(request(body)); expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ created: 250, total: 250, valid: 250, errors: [] });
    expect(m.create).toHaveBeenCalledTimes(1);
  });
  it("accepts the exact 550,000-byte boundary", async () => {
    const body = JSON.stringify({ csv: toCsv([Array.from(columns), ["category-board", "general", "سؤال حدود صالح؟", "واحد", "", "", "EASY", 200, "TEXT", "", "", "DRAFT", "ar", "", "", ""]]), dryRun: true });
    const exact = body + " ".repeat(550_000 - new TextEncoder().encode(body).length);
    const response = await POST(request(exact)); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ valid: 1, created: 0 });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("rejects oversized chunked import before bank lookups or writes", async () => {
    let pulls = 0; const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ pull(c) { pulls++; c.enqueue(new Uint8Array(100_000)); }, cancel }, { highWaterMark: 0 });
    expect((await POST(request(stream))).status).toBe(413); expect(pulls).toBe(6); expect(cancel).toHaveBeenCalledTimes(1);
    expect(m.games).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  });
  it("keeps authorization and invalid JSON/schema safe", async () => {
    m.user.mockResolvedValue(null); expect((await POST(request("unused"))).status).toBe(403);
    m.user.mockResolvedValue({ role: "ADMIN" }); expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ csv: "", dryRun: true })))).status).toBe(400);
  });
});
