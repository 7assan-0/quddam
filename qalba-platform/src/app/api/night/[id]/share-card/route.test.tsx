import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { NextRequest } from "next/server";
import type { NightView } from "@/lib/night/types";
import { NIGHT_GAMES } from "@/lib/night/catalog";

const m = vi.hoisted(() => ({ user: vi.fn(), view: vi.fn(), error: vi.fn(), element: null as unknown }));
vi.mock("@/lib/auth/session", () => ({ currentUser: m.user }));
vi.mock("@/lib/night/service", () => ({
  getNightView: m.view,
  NightServiceError: class extends Error {
    constructor(message: string, readonly status: number, readonly code: string) { super(message); }
  },
}));
vi.mock("@/lib/night/http", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/night/http")>();
  return { ...actual, nightErrorResponse: (error: unknown) => { m.error(error); return actual.nightErrorResponse(error); } };
});
vi.mock("next/og", async importOriginal => {
  const actual = await importOriginal<typeof import("next/og")>();
  return { ...actual, ImageResponse: class extends actual.ImageResponse {
    constructor(...args: ConstructorParameters<typeof actual.ImageResponse>) {
      m.element = args[0];
      super(...args);
    }
  } };
});
import { GET } from "./route";
import { NightServiceError } from "@/lib/night/service";

function fixture(tied = false): NightView {
  const teams = [{ id: "team-a", name: "البرق" }, { id: "team-b", name: "الموج" }];
  const totals = { "team-a": 9, "team-b": tied ? 9 : 6 };
  return { id: "private-night-id", phase: "completed", version: 9, teams,
    games: NIGHT_GAMES.map((game, position) => ({ ...game, position, hostHref: null, sourceStatus: "COMPLETED", imported: true })),
    currentIndex: 2, current: null, importReady: false, blockedReason: null, canNext: false,
    results: NIGHT_GAMES.map(game => ({ game: game.game, sourceSessionId: `private-source-${game.game}`,
      placements: tied ? [{ teamIds: teams.map(t => t.id) }] : teams.map(t => ({ teamIds: [t.id] })), points: { "team-a": 3, "team-b": tied ? 3 : 2 } })),
    totals, ranking: teams.map(team => ({ ...team, points: totals[team.id as keyof typeof totals] })), winnerIds: tied ? teams.map(t => t.id) : [teams[0].id] };
}
const context = { params: Promise.resolve({ id: "private-night-id" }) };
const nativeFetch = globalThis.fetch;
function denyExternalFetch() {
  const external = vi.fn();
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("data:")) return nativeFetch(input, init); // Bundled WASM, no network.
    external(new URL(url).origin);
    throw new Error("Unexpected external asset request");
  });
  return external;
}
const request = () => new NextRequest("http://localhost:3000/api/night/private-night-id/share-card");
beforeEach(() => {
  vi.clearAllMocks(); m.element = null;
  vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true");
  m.user.mockResolvedValue({ id: "owner" }); m.view.mockResolvedValue(fixture());
  denyExternalFetch();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

/** HTTP authority is mocked here; PNG conversion and local font parsing are real. */
describe("private Night share card", () => {
  it("renders a real 1200×630 PNG using local Arabic fonts, private headers and no source identifiers", async () => {
    const fetch = denyExternalFetch();
    const response = await GET(request(), context);
    expect(m.error.mock.calls.map(([error]) => error instanceof Error ? error.stack : String(error))).toEqual([]);
    expect(response.status).toBe(200);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(bytes.readUInt32BE(16)).toBe(1200); expect(bytes.readUInt32BE(20)).toBe(630);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("content-disposition")).toContain('attachment; filename="quddam-night.png"');
    const html = renderToStaticMarkup(m.element as ReactElement);
    expect(html).toContain("البرق"); expect(html).toContain("الموج");
    expect(html).not.toContain("private-night-id"); expect(html).not.toContain("private-source");
    expect(html).not.toContain("team-a"); expect(fetch).not.toHaveBeenCalled();
  }, 30_000);

  it("labels tied champions in the plural and includes both names", async () => {
    m.view.mockResolvedValue(fixture(true));
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    await response.arrayBuffer();
    const html = renderToStaticMarkup(m.element as ReactElement);
    expect(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).toContain("أبطال الليلة");
    expect(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).toContain("البرق و الموج");
    expect(html).toContain('data-card-rtl="true"');
    expect(html).toContain("flex-direction:row-reverse");
  }, 30_000);

  it("does not fetch remote emoji or font assets for valid non-Arabic team names", async () => {
    const view = fixture();
    view.teams[0].name = "فريق 🎉 中文"; view.ranking[0].name = view.teams[0].name;
    const fetch = denyExternalFetch(); m.view.mockResolvedValue(view);
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    await response.arrayBuffer();
    expect(renderToStaticMarkup(m.element as ReactElement).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).toContain("رموز الأسماء غير المدعومة معروضة بصيغة Unicode");
    expect(fetch).not.toHaveBeenCalled();
  }, 30_000);

  it("renders bounded valid long names without remote assets", async () => {
    const view = fixture(true);
    for (let i = 0; i < view.teams.length; i++) {
      view.teams[i].name = (i ? "W" : "م").repeat(60);
      view.ranking[i].name = view.teams[i].name;
    }
    m.view.mockResolvedValue(view);
    const fetch = denyExternalFetch();
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1_000);
    expect(fetch).not.toHaveBeenCalled();
  }, 30_000);

  it("renders both 60-character unsupported names with unique local Unicode labels", async () => {
    const view = fixture(true);
    view.teams[0].name = "中".repeat(60); view.teams[1].name = "文".repeat(60);
    view.ranking.forEach((team, i) => { team.name = view.teams[i].name; });
    m.view.mockResolvedValue(view);
    const fetch = denyExternalFetch();
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1_000);
    const html = renderToStaticMarkup(m.element as ReactElement);
    expect(html).toContain("[U+4E2D]"); expect(html).toContain("[U+6587]");
    expect(fetch).not.toHaveBeenCalled();
  }, 30_000);

  it("rejects disabled, unauthenticated and other-owner requests before rendering", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "false");
    expect((await GET(request(), context)).status).toBe(404);
    expect(m.user).not.toHaveBeenCalled(); expect(m.view).not.toHaveBeenCalled();
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true"); m.user.mockResolvedValueOnce(null);
    expect((await GET(request(), context)).status).toBe(401);
    m.view.mockRejectedValueOnce(new NightServiceError("الليلة غير موجودة", 404, "NOT_FOUND"));
    expect((await GET(request(), context)).status).toBe(404);
    expect(m.element).toBeNull();
  });

  it.each(["preparing", "playing", "ended"] as const)("does not render a champion card for %s", async phase => {
    m.view.mockResolvedValue({ ...fixture(), phase });
    const response = await GET(request(), context);
    expect(response.status).toBe(409); expect(m.element).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("sanitizes unexpected failures without disclosing database connection details", async () => {
    m.view.mockRejectedValue(new Error("postgresql://private:secret@db.example/private"));
    const response = await GET(request(), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/postgresql|secret|db\.example/);
  });
});
