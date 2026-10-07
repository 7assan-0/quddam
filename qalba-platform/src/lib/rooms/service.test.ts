import { describe, expect, it } from "vitest";
import { normalizeCode, roomCode, RoomError } from "./service";

describe("room codes", () => {
  it("uses six clear uppercase characters and accepts lowercase entry", () => {
    for (let i = 0; i < 100; i++) expect(roomCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(normalizeCode(" 7k4p2q ")).toBe("7K4P2Q");
  });
  it("rejects ambiguous or malformed codes", () => {
    expect(() => normalizeCode("0I1O6S")).toThrow(RoomError);
    expect(() => normalizeCode("short")).toThrow(RoomError);
  });
});
