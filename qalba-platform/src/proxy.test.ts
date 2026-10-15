import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const authorize = vi.hoisted(() => vi.fn());
vi.mock("@/lib/games/lightning/service", () => ({ assertLightningPageAccess: authorize }));
import { proxy } from "./proxy";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("Night page gate precedes layout streaming", () => {
  it.each([undefined, "false", "TRUE", "1"])("returns a real private 404 for disabled flag %s", async flag => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", flag);
    for (const path of ["/night", "/night/new", "/night/saved-series", `/night/invite/${"a".repeat(64)}`]) {
      const response = await proxy(new NextRequest(`http://localhost:3000${path}`));
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(response.headers.get("x-middleware-next")).toBeNull();
      expect(await response.text()).not.toContain("saved-series");
    }
    expect(authorize).not.toHaveBeenCalled();
  });
  it("allows explicitly enabled pages to reach their existing authenticated handlers", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true");
    const response = await proxy(new NextRequest("http://localhost:3000/night/saved-series"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("content-security-policy-report-only")).toBeTruthy();
    expect(authorize).not.toHaveBeenCalled();
  });
  it("protects bearer invitation URLs with no-referrer, no-store and noindex", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true");
    const response = await proxy(new NextRequest(`http://localhost:3000/night/invite/${"a".repeat(64)}`));
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
  it("blocks Shillatak page streaming unless both feature flags are on, even for bearer paths", async () => {
    for (const [night, shilla] of [["false","true"],["true","false"]]) {
      vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", night); vi.stubEnv("ENABLE_SHILLATAK", shilla);
      for (const pathname of ["/shillatak", "/shillatak/00000000-0000-4000-8000-000000000001",
        `/shillatak/join/${"a".repeat(64)}`]) {
        const response = await proxy(new NextRequest(`http://localhost:3000${pathname}`));
        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(response.headers.get("referrer-policy")).toBe("no-referrer");
        expect(response.headers.get("x-middleware-next")).toBeNull();
      }
    }
  });
  it("redacts the join bearer page when enabled", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM","true"); vi.stubEnv("ENABLE_SHILLATAK","true");
    const response = await proxy(new NextRequest(`http://localhost:3000/shillatak/join/${"a".repeat(64)}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
  it.each(["/games", "/nightmare"])("preserves unrelated page forwarding for %s", async path => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", undefined);
    const response = await proxy(new NextRequest(`http://localhost:3000${path}`));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
