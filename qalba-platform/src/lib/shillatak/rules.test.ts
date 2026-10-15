import { describe, expect, it, vi } from "vitest";
import { acceptVerifiedResult, advanceNight, prepareNight, startNight, type NightState } from "@/lib/night/core";
import { completedSnapshot, normalizedName, shillaLeaderboard, shillaEnabled, validateCreate } from "./rules";
const ids = ["night-a", "night-b"];
const games = ["top-list", "ordering-challenge", "survey-show"] as const;
const nightTeams = [{ id: "n-a", name: "البرق" }, { id: "n-b", name: "الموج" }];
const stable = [{ id: "s-a", name: "البرق", position: 0 }, { id: "s-b", name: "الموج", position: 1 }];
function completed(tie = false) {
  let state: NightState = startNight(prepareNight({ nightId: ids[0], games, teams: nightTeams }));
  const slots = [];
  for (let i = 0; i < games.length; i++) {
    if (i) state = advanceNight(state);
    const placements = tie && i === 2
      ? [{ teamIds: ["n-a", "n-b"] }]
      : tie && i === 1 ? [{ teamIds: ["n-b"] }, { teamIds: ["n-a"] }]
      : [{ teamIds: ["n-a"] }, { teamIds: ["n-b"] }];
    state = acceptVerifiedResult(state, { game: games[i], sourceSessionId: `source-${i}`, placements });
    slots.push({ position: i, gameSlug: games[i], sourceSessionId: `source-${i}`,
      resultDigest: String(i + 1).repeat(64), acceptedAt: new Date(),
      resultReceipt: { schemaVersion: 1, game: games[i], sourceSessionId: `source-${i}`,
        digest: String(i + 1).repeat(64), placements: state.results[i].placements } });
  }
  return { id: ids[0], phase: state.phase, stateVersion: state.version, state, games: slots };
}
describe("Shillatak pure privacy and immutable result bridge", () => {
  it("is opt-in and nested under the Night feature", () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true"); vi.stubEnv("ENABLE_SHILLATAK", "false");
    expect(shillaEnabled()).toBe(false);
    vi.stubEnv("ENABLE_SHILLATAK", "true"); expect(shillaEnabled()).toBe(true);
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "false"); expect(shillaEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });
  it("normalizes group/team aliases and rejects duplicate or deceptive names", () => {
    expect(normalizedName("  فريـق   ألف  ").name).toBe("فريـق ألف");
    expect(() => normalizedName("أ\u202Eب")).toThrow();
    expect(() => normalizedName("a")).toThrow();
    expect(() => validateCreate({ name: "جمعتنا", teams: ["فريق ألف", "فريق ألف"] })).toThrow();
    expect(validateCreate({ name: "جمعتنا", teams: ["البرق", "الموج"] }).teams.map(t => t.name))
      .toEqual(["البرق", "الموج"]);
  });
  it("replays three frozen Night receipts rather than trusting arbitrary team scores", () => {
    const night = completed();
    const snap = completedSnapshot(night, stable);
    expect(snap.teams).toEqual([
      { shillaTeamId: "s-a", name: "البرق", points: 9, champion: true },
      { shillaTeamId: "s-b", name: "الموج", points: 6, champion: false },
    ]);
    expect(snap.sourceDigests).toHaveLength(3);
    expect(JSON.stringify(snap)).not.toContain("sourceSessionId");
    expect(JSON.stringify(snap)).not.toContain("answer");
  });
  it("rejects early-ended nights, mismatched stable teams, missing or forged receipts and score edits", () => {
    const early = completed(); early.phase = "ended";
    expect(() => completedSnapshot(early, stable)).toThrow();
    expect(() => completedSnapshot(completed(), [{ ...stable[0], name: "فريق مختلف" }, stable[1]])).toThrow();
    const missing = completed(); missing.games[1].acceptedAt = null;
    expect(() => completedSnapshot(missing, stable)).toThrow();
    const forged = completed(); forged.games[2].resultDigest = "b".repeat(64);
    expect(() => completedSnapshot(forged, stable)).toThrow();
    const scores = completed(); scores.state.totals["n-a"] = 9000;
    expect(() => completedSnapshot(scores, stable)).toThrow();
  });
  it("does not attribute team wins to member accounts and counts both co-champions", () => {
    const first = completedSnapshot(completed(), stable);
    const tied = completedSnapshot(completed(true), stable);
    expect(tied.teams.every(t => t.champion)).toBe(true);
    const board = shillaLeaderboard(stable, [first, tied]);
    expect(board).toEqual([
      { id: "s-a", name: "البرق", wins: 2, points: 17, played: 2, rank: 1 },
      { id: "s-b", name: "الموج", wins: 1, points: 14, played: 2, rank: 2 },
    ]);
    expect(JSON.stringify(board)).not.toContain("userId");
  });
  it("competition ranking shows joint first when win count and points tie", () => {
    const tie = completedSnapshot(completed(true), stable);
    const board = shillaLeaderboard(stable, [tie]);
    expect(board.map(x => x.rank)).toEqual([1, 1]);
    expect(board.map(x => x.wins)).toEqual([1, 1]);
  });
});
