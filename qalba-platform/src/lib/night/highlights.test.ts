import { describe, expect, it } from "vitest";
import { deriveNightHighlights } from "./highlights";
import type { NightView } from "./types";
const teams = [{ id: "a", name: "البرق" }, { id: "b", name: "الموج" }];
const games = [
  { game: "top-list" as const, title: "توب 100", position: 0, hostHref: null, sourceStatus: "COMPLETED", imported: true },
  { game: "ordering-challenge" as const, title: "رتّبها", position: 1, hostHref: null, sourceStatus: "COMPLETED", imported: true },
  { game: "survey-show" as const, title: "قالوا الناس", position: 2, hostHref: null, sourceStatus: "COMPLETED", imported: true },
];
function fixture(phase: NightView["phase"] = "completed"): NightView {
  return { id: "night-1", phase, version: 9, teams, games, currentIndex: 2, current: null,
    importReady: false, blockedReason: null, canNext: false,
    results: [
      { game: "top-list", sourceSessionId: "s1", placements: [{ teamIds: ["a"] }, { teamIds: ["b"] }], points: { a: 3, b: 2 } },
      { game: "ordering-challenge", sourceSessionId: "s2", placements: [{ teamIds: ["a"] }, { teamIds: ["b"] }], points: { a: 3, b: 2 } },
      { game: "survey-show", sourceSessionId: "s3", placements: [{ teamIds: ["a"] }, { teamIds: ["b"] }], points: { a: 3, b: 2 } },
    ], totals: { a: 9, b: 6 },
    ranking: [{ ...teams[0], points: 9 }, { ...teams[1], points: 6 }], winnerIds: phase === "completed" ? ["a"] : [] };
}
describe("Night recap is derived from accepted results, never simulated events", () => {
  it("refuses a champion or recap before ending", () => {
    expect(deriveNightHighlights(fixture("playing"))).toBeNull();
    expect(deriveNightHighlights(fixture("preparing"))).toBeNull();
  });
  it("summarizes the 9–6 verified night with winners and actual game counts only", () => {
    const recap = deriveNightHighlights(fixture());
    expect(recap).toMatchObject({ phase: "completed", played: 3, championNames: ["البرق"],
      ranking: [{ name: "البرق", points: 9 }, { name: "الموج", points: 6 }] });
    expect(recap?.games).toHaveLength(3);
    expect(recap?.games.every(g => g.firstNames[0] === "البرق")).toBe(true);
    expect(recap?.facts.join(" ")).toContain("3");
    expect(JSON.stringify(recap)).not.toContain("sourceSessionId");
    expect(JSON.stringify(recap)).not.toContain("answer");
    expect(JSON.stringify(recap)).not.toContain("0.32");
  });
  it("never invents a champion for an incomplete night, and supports joint champions", () => {
    expect(deriveNightHighlights(fixture("ended"))).toMatchObject({ championNames: [], phase: "ended" });
    const tied = fixture(); tied.winnerIds = ["a", "b"]; tied.ranking = teams.map(team => ({ ...team, points: 8 }));
    expect(deriveNightHighlights(tied)?.championNames).toEqual(["البرق", "الموج"]);
  });
});
