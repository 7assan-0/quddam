import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { consumeJoinAdmission, joinAdmissionTarget } from "./admission";
import { parseJson } from "@/lib/http";
import { joinRoom } from "@/lib/rooms/service";
import { joinSocialSession, socialPreview } from "@/lib/games/social-deduction/service";
import { joinCourt } from "@/lib/games/court/service";
import { joinBluff } from "@/lib/games/bluff/service";
import { POST as boardJoin } from "@/app/api/rooms/[code]/join/route";
import { POST as socialJoin } from "@/app/api/social/[id]/join/route";
import { POST as courtJoin } from "@/app/api/court/[id]/join/route";
import { POST as bluffJoin } from "@/app/api/bluff/[id]/join/route";

vi.mock("@/lib/rooms/admission", () => ({
  consumeJoinAdmission: vi.fn(),
  joinAdmissionTarget: vi.fn((_kind: string, raw: string) => raw.trim().toUpperCase()),
}));
vi.mock("@/lib/http", () => ({
  requireSameOrigin: vi.fn(() => true),
  parseJson: vi.fn(),
  forbidden: vi.fn(() => new Response(null, { status: 403 })),
  errorResponse: vi.fn(() => new Response(null, { status: 500 })),
}));
vi.mock("@/lib/auth/session", () => ({ currentUser: vi.fn(async () => null) }));
vi.mock("@/lib/rooms/service", () => ({
  joinRoom: vi.fn(), RoomError: class RoomError extends Error { status = 400; },
}));
vi.mock("@/lib/games/social-deduction/module", () => ({
  SocialError: class SocialError extends Error { status = 400; code = "ERROR"; },
}));
vi.mock("@/lib/games/social-deduction/service", () => ({
  socialPreview: vi.fn(), joinSocialSession: vi.fn(),
}));
vi.mock("@/lib/games/court/http", () => ({ courtResponse: vi.fn(), privateHeaders: { "Cache-Control": "private, no-store" } }));
vi.mock("@/lib/games/bluff/http", () => ({ bluffResponse: vi.fn(), privateHeaders: { "Cache-Control": "private, no-store" } }));
vi.mock("@/lib/games/court/service", () => ({ joinCourt: vi.fn(), cookieName: () => "court-test-token" }));
vi.mock("@/lib/games/bluff/service", () => ({ joinBluff: vi.fn(), cookieName: () => "bluff-test-token" }));
vi.mock("@/lib/games/court/validation", () => ({ joinSchema: {} }));
vi.mock("@/lib/games/bluff/validation", () => ({ joinSchema: {} }));

const id = "315afc1d-3444-4d72-aabc-8f1314112a9e";
const request = () => new NextRequest("https://quddam.test/api/join", {
  method: "POST", headers: { Origin: "https://quddam.test" }, body: "{}",
});
const boardParams = (code: string) => ({ params: Promise.resolve({ code }) });
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("every guest join is admission-gated before parsing or session work", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(joinAdmissionTarget).mockImplementation((_kind, raw) => raw.trim().toUpperCase());
    vi.mocked(consumeJoinAdmission).mockResolvedValue(false);
    vi.mocked(parseJson).mockResolvedValue({ code: "7K4P2Q", name: "Player", teamId: "team-1" });
  });

  it("Board returns 429 without invoking the join service for a canonical room", async () => {
    const response = await boardJoin(request(), boardParams(" 7k4p2q "));
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(consumeJoinAdmission).toHaveBeenCalledWith(expect.any(NextRequest), "board", "7K4P2Q");
    expect(parseJson).not.toHaveBeenCalled();
    expect(joinRoom).not.toHaveBeenCalled();
  });
  it("Social returns 429 before preview/session lookup or body parsing", async () => {
    const response = await socialJoin(request(), idParams(id));
    expect(response.status).toBe(429);
    expect(consumeJoinAdmission).toHaveBeenCalledWith(expect.any(NextRequest), "social", id);
    expect(parseJson).not.toHaveBeenCalled();
    expect(socialPreview).not.toHaveBeenCalled();
    expect(joinSocialSession).not.toHaveBeenCalled();
  });
  it("Court returns 429 before user lookup, validation or participant admission", async () => {
    const response = await courtJoin(request(), idParams(id));
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(consumeJoinAdmission).toHaveBeenCalledWith(expect.any(NextRequest), "court", id);
    expect(parseJson).not.toHaveBeenCalled();
    expect(joinCourt).not.toHaveBeenCalled();
  });
  it("Bluff returns 429 before validation or participant admission", async () => {
    const response = await bluffJoin(request(), idParams(id));
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(consumeJoinAdmission).toHaveBeenCalledWith(expect.any(NextRequest), "bluff", id);
    expect(parseJson).not.toHaveBeenCalled();
    expect(joinBluff).not.toHaveBeenCalled();
  });
});
