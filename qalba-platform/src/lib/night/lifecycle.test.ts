import { describe, expect, it } from "vitest";
import { acceptVerifiedResult, advanceNight, endNight, nightLeaderboard, prepareNight, startNight } from "./core";
const prepare = () => prepareNight({ nightId: "n1", games: ["top-list", "ordering-challenge", "survey-show"], teams: [{ id: "a", name: "البرق" }, { id: "b", name: "الموج" }] });
describe("persisted Night lifecycle composes existing normalized rules", () => {
  it("prepares without playing, starts once, and requires import before advancing", () => {
    const p = prepare(); expect(p).toMatchObject({ phase: "preparing", version: 0, currentIndex: 0, results: [] });
    expect(() => acceptVerifiedResult(p, { game: "top-list", sourceSessionId: "s1", placements: [{ teamIds: ["a"] }, { teamIds: ["b"] }] })).toThrow();
    const s = startNight(p); expect(s).toMatchObject({ phase: "playing", version: 1 }); expect(() => startNight(s)).toThrow(); expect(() => advanceNight(s)).toThrow();
    const r = acceptVerifiedResult(s, { game: "top-list", sourceSessionId: "s1", placements: [{ teamIds: ["a"] }, { teamIds: ["b"] }] });
    expect(r.currentIndex).toBe(0); const next = advanceNight(r); expect(next).toMatchObject({ currentIndex: 1, version: 3, totals: { a: 3, b: 2 } }); expect(() => advanceNight(next)).toThrow();
  });
  it("ending preserves accepted totals but never awards a champion or accepts more games", () => {
    const s = startNight(prepare()), ended = endNight(s); expect(ended.phase).toBe("ended"); expect(nightLeaderboard(ended).winnerIds).toEqual([]); expect(endNight(ended)).toBe(ended);
    expect(() => advanceNight(ended)).toThrow(); expect(() => acceptVerifiedResult(ended, { game: "top-list", sourceSessionId: "s1", placements: [{ teamIds: ["a", "b"] }] })).toThrow();
  });
});
