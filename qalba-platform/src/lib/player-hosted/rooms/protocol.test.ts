import { describe, expect, it } from "vitest";
import { acceptBuzz, hostAction, initialState, newer, parseIntent, parseSnapshot } from "./protocol";

describe("multi-player transport-independent authority", () => {
  it("accepts only the first current-round buzz and one host award", () => {
    const open = hostAction(initialState(), "open"), locked = acceptBuzz(open, 2, 1);
    expect(locked.winner).toBe(2);
    expect(acceptBuzz(locked, 3, 1)).toBe(locked);
    const result = hostAction(locked, "award");
    expect(result.scores).toEqual([0, 0, 1, 0]);
    expect(hostAction(result, "award")).toBe(result);
    const next = hostAction(result, "open");
    expect(next).toMatchObject({ round: 2, version: 4, winner: null, phase: "open" });
    expect(acceptBuzz(next, 3, 1)).toBe(next);
  });
  it("rejects guest score/host commands, identities, duplicates and oversized malformed intents", () => {
    for (const value of [{ type: "AWARD" }, { type: "BUZZ", round: 1, slot: 0 }, { type: "BUZZ", round: "1" },
      { type: "BUZZ", round: 101 }, { scores: [99, 0, 0, 0] }]) expect(parseIntent(JSON.stringify(value))).toBeNull();
    expect(parseIntent("x".repeat(129))).toBeNull(); expect(parseIntent("{" )).toBeNull();
    expect(parseIntent(JSON.stringify({ type: "BUZZ", round: 1 }))).toEqual({ type: "BUZZ", round: 1 });
  });
  it("validates snapshots and rejects old/equal versions and score/round rollback", () => {
    const zero = initialState(), open = hostAction(zero, "open");
    expect(parseSnapshot(JSON.stringify(zero))).toEqual(zero);
    expect(newer(zero, open, 0)).toBe(true); expect(newer(open, open, 1)).toBe(false);
    for (const value of [{ ...open, phase: ["open"] }, { ...open, winner: 1 }, { ...open, scores: [0, 99, 0, 0] },
      { ...open, version: 300 }, { ...zero, round: 1 }]) expect(parseSnapshot(JSON.stringify(value))).toBeNull();
    const result = hostAction(acceptBuzz(open, 1, 1), "award");
    expect(newer(result, { ...result, version: 4, scores: [0, 0, 0, 0] }, 3)).toBe(false);
  });
  it("bounds rounds, skips without points and rejects nonexistent players", () => {
    let state = initialState();
    for (let round = 0; round < 100; round++) state = hostAction(hostAction(state, "open"), "skip");
    expect(hostAction(state, "open")).toBe(state);
    const open = hostAction(initialState(), "open");
    expect(acceptBuzz(open, 4, 1)).toBe(open); expect(acceptBuzz(open, -1, 1)).toBe(open);
    expect(parseSnapshot(JSON.stringify(state))).toEqual(state);
  });
});
