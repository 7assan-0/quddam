import { describe, expect, it } from "vitest";
import { awardPoint, buzz, initialLabState, openRound, parseGuestIntent, parseHostSnapshot, parseSessionDescription, skipRound } from "./lab";

describe("isolated player-hosted buzzer protocol", () => {
  it("accepts the first valid buzz for a live round and rejects stale or duplicate intents", () => {
    const opened = openRound(initialLabState());
    expect(buzz(opened, 1, 0)).toBe(opened);
    const won = buzz(opened, 1, opened.round);
    expect(won.winner).toBe(1);
    expect(won.phase).toBe("locked");
    expect(buzz(won, 0, won.round)).toBe(won);
    expect(buzz(won, 1, won.round)).toBe(won);
    expect(awardPoint(won).scores).toEqual([0, 1]);
  });

  it("awards only on the host after a lock, at most once", () => {
    const start = initialLabState();
    expect(awardPoint(start)).toBe(start);
    const opened = openRound(start);
    const locked = buzz(opened, 0, 1);
    const result = awardPoint(locked);
    expect(result.scores).toEqual([1, 0]);
    expect(awardPoint(result)).toBe(result);
    expect(openRound(result)).toMatchObject({ round: 2, scores: [1, 0], winner: null, phase: "open" });
    expect(skipRound(openRound(result)).scores).toEqual([1, 0]);
  });

  it("never interprets a guest packet as a host command or score", () => {
    expect(parseGuestIntent(JSON.stringify({ type: "BUZZ", round: 1 }))).toEqual({ type: "BUZZ", round: 1 });
    for (const packet of [
      { type: "SCORE", round: 1 }, { type: "OPEN_ROUND", round: 1 },
      { type: "BUZZ", round: 1, scores: [99, 0] }, { type: "BUZZ", round: -1 },
      { type: "BUZZ", round: 1.5 }, { type: "BUZZ", round: "1" },
      [], null,
    ]) expect(parseGuestIntent(JSON.stringify(packet))).toBeNull();
    expect(parseGuestIntent("x".repeat(129))).toBeNull();
    expect(parseGuestIntent("{")).toBeNull();
  });

  it("rejects malformed snapshots and retains monotonic host versions at the caller", () => {
    const next = awardPoint(buzz(openRound(initialLabState()), 0, 1));
    expect(parseHostSnapshot(JSON.stringify(next))).toEqual(next);
    expect(parseHostSnapshot(JSON.stringify({ ...next, protocol: 2 }))).toBeNull();
    expect(parseHostSnapshot(JSON.stringify({ ...next, scores: [999, 0] }))).toBeNull();
    expect(parseHostSnapshot(JSON.stringify({ ...next, winner: 3 }))).toBeNull();
    expect(parseHostSnapshot(JSON.stringify({ ...next, phase: "open" }))).toBeNull();
    expect(parseHostSnapshot(JSON.stringify({ ...next, secret: "do not accept" }))).toBeNull();
    expect(parseHostSnapshot("a".repeat(1025))).toBeNull();
  });

  it("only accepts bounded descriptions of the expected type", () => {
    const offer = JSON.stringify({ type: "offer", sdp: "v=0\r\n" + "x".repeat(30) });
    expect(parseSessionDescription(offer, "offer").type).toBe("offer");
    expect(() => parseSessionDescription(offer, "answer")).toThrow();
    expect(() => parseSessionDescription(JSON.stringify({ type: "offer", sdp: "v=0\r\n" + "x".repeat(30), extra: 1 }), "offer")).toThrow();
    expect(() => parseSessionDescription("{", "offer")).toThrow();
    expect(() => parseSessionDescription("x".repeat(100001), "offer")).toThrow();
  });

  it("rejects coerced phases, impossible round/score combinations and unbounded versions", () => {
    const opened = openRound(initialLabState());
    const result = awardPoint(buzz(opened, 0, 1));
    for (const snapshot of [
      { ...opened, phase: ["open"] }, { ...opened, version: 999 },
      { ...opened, phase: "waiting" }, { ...opened, scores: [1, 0] },
      { ...result, scores: [1, 1] }, { ...initialLabState(), version: 1 },
      { ...result, version: 1 },
    ]) expect(parseHostSnapshot(JSON.stringify(snapshot))).toBeNull();
  });

  it("accepts every legitimate bounded round including skips, then stops at 100", () => {
    let state = initialLabState();
    for (let round = 1; round <= 100; round++) {
      state = openRound(state);
      expect(parseHostSnapshot(JSON.stringify(state))).toEqual(state);
      if (round % 3 === 0) state = skipRound(state);
      else {
        state = buzz(state, round % 2 ? 0 : 1, round);
        expect(parseHostSnapshot(JSON.stringify(state))).toEqual(state);
        state = round % 3 === 1 ? awardPoint(state) : skipRound(state);
      }
      expect(parseHostSnapshot(JSON.stringify(state))).toEqual(state);
    }
    expect(openRound(state)).toBe(state);
  });
});
