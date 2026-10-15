import { describe, expect, it } from "vitest";
import { acceptVerifiedResult, createNight, nightLeaderboard, type NightTeam, type VerifiedGameOutcome } from "./core";

const games = ["lightning-quiz", "the-court", "survey-show"] as const;
const teams: NightTeam[] = [{ id: "team-a", name: "البرق" }, { id: "team-b", name: "الموج" }];
const night = () => createNight({ nightId: "night-1", games, teams });
const outcome = (sourceSessionId: string, game: VerifiedGameOutcome["game"], ...groups: string[][]): VerifiedGameOutcome =>
  ({ sourceSessionId, game, placements: groups.map(teamIds => ({ teamIds })) });

describe("Night of Quddam: isolated, official-game, normalized series rules", () => {
  it("selects only three to ten distinct official launch games and stable two/three teams", () => {
    expect(night()).toMatchObject({ schemaVersion: 1, phase: "playing", games, version: 0 });
    expect(night().totals).toEqual({ "team-a": 0, "team-b": 0 });
    expect(() => createNight({ nightId: "a", games: games.slice(0, 2), teams })).toThrow("3–10");
    expect(() => createNight({ nightId: "a", games: [...games, games[0]], teams })).toThrow("3–10");
    expect(() => createNight({ nightId: "a", games: [...games, "legacy-party"], teams })).toThrow("3–10");
    expect(() => createNight({ nightId: "a", games, teams: [teams[0]] })).toThrow("two or three");
    expect(() => createNight({ nightId: "a", games, teams: [teams[0], { ...teams[1], id: "team-a" }] })).toThrow("Duplicate");
    expect(() => createNight({ nightId: "a", games, teams: [teams[0], { ...teams[1], name: "البرق" }] })).toThrow("Duplicate");
    expect(() => createNight({ nightId: "a", games, teams: [teams[0], { ...teams[1], name: "unsafe\nname" }] })).toThrow("Invalid team");
    expect(() => createNight({ nightId: "x ?", games, teams })).toThrow("Invalid night ID");
  });
  it("derives points from a verified result, never takes scores from the caller", () => {
    const s = night();
    const reported = { ...outcome("source-1", games[0], ["team-a"], ["team-b"]), points: { "team-a": 999 } };
    const next = acceptVerifiedResult(s, reported);
    expect(next).toMatchObject({ version: 1, phase: "playing", totals: { "team-a": 3, "team-b": 2 } });
    expect(next.results[0].points).toEqual({ "team-a": 3, "team-b": 2 });
    expect(s.totals).toEqual({ "team-a": 0, "team-b": 0 }); // immutable
    expect(nightLeaderboard(next).winnerIds).toEqual([]); // no premature champion
  });
  it("keeps game ordering and rejects accidental duplicate counts or altered replays", () => {
    const s = night();
    expect(() => acceptVerifiedResult(s, outcome("s2", games[1], ["team-b"], ["team-a"]))).toThrow("Unexpected");
    const first = outcome("s1", games[0], ["team-a"], ["team-b"]);
    const next = acceptVerifiedResult(s, first);
    expect(acceptVerifiedResult(next, first)).toBe(next); // idempotent retry
    expect(() => acceptVerifiedResult(next, outcome("s1", games[0], ["team-b"], ["team-a"]))).toThrow("rewritten");
    expect(() => acceptVerifiedResult(next, outcome("s1", games[1], ["team-a"], ["team-b"]))).toThrow("rewritten");
    expect(() => acceptVerifiedResult(next, outcome("s3", games[2], ["team-a"], ["team-b"]))).toThrow("Unexpected");
  });
  it("requires exactly one placement per team and rejects forged, missing or duplicated teams", () => {
    const s = night();
    for (const groups of [
      [["team-a"]], [["team-a"], ["team-a"]], [["team-a"], ["third"]],
      [[], ["team-b"]], [["team-a", "team-b"], ["team-b"]],
    ]) expect(() => acceptVerifiedResult(s, outcome("session-1", games[0], ...groups))).toThrow();
    expect(s.results).toHaveLength(0);
  });
  it("allows ties with competition ranks and can end with joint champions", () => {
    const three = createNight({ nightId: "night-3", games, teams: [...teams, { id: "team-c", name: "الفريق الثالث" }] });
    const tied = acceptVerifiedResult(three, outcome("s1", games[0], ["team-b", "team-a"], ["team-c"]));
    expect(tied.results[0].placements[0].teamIds).toEqual(["team-a", "team-b"]);
    expect(tied.totals).toEqual({ "team-a": 3, "team-b": 3, "team-c": 1 });
    let s = acceptVerifiedResult(night(), outcome("s1", games[0], ["team-a"], ["team-b"]));
    s = acceptVerifiedResult(s, outcome("s2", games[1], ["team-b"], ["team-a"]));
    s = acceptVerifiedResult(s, outcome("s3", games[2], ["team-a", "team-b"]));
    expect(s).toMatchObject({ phase: "completed", version: 3, totals: { "team-a": 8, "team-b": 8 } });
    expect(nightLeaderboard(s)).toMatchObject({ completed: true, played: 3, totalGames: 3, winnerIds: ["team-a", "team-b"] });
    expect(acceptVerifiedResult(s, outcome("s3", games[2], ["team-a", "team-b"]))).toBe(s);
    expect(() => acceptVerifiedResult(s, outcome("s4", games[2], ["team-a"], ["team-b"]))).toThrow("complete");
  });
});
