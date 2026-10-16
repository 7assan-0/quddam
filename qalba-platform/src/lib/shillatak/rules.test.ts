import { describe, expect, it, vi } from "vitest";
import { acceptVerifiedResult, advanceNight, prepareNight, startNight, type NightState } from "@/lib/night/core";
import { completedSnapshot, jsonDigest, normalizedName, shillaLeaderboard, shillaEnabled, snapshotDigest, validateCreate } from "./rules";
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
    const scores = placements.length === 1 ? [0, 0] : placements[0].teamIds[0] === "n-a" ? [10, 5] : [5, 10];
    const receipt = { schemaVersion: 1 as const, sourceSessionId: `source-${i}`,
      sourceVersion: i + 10, matchNumber: 1 as const, game: games[i],
      placements: state.results[i].placements,
      scores: nightTeams.map((team, index) => ({ nightTeamId: team.id, score: scores[index] })),
      sourceDigest: String(i + 1).repeat(64) };
    const resultReceipt = { ...receipt, digest: jsonDigest(receipt) };
    slots.push({ position: i, gameSlug: games[i], sourceSessionId: `source-${i}`,
      sourceVersion: receipt.sourceVersion, resultDigest: resultReceipt.digest,
      acceptedAt: new Date() as Date | null, resultReceipt });
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
  it("rejects extra authority fields and malformed direct service inputs before normalization", () => {
    const valid = { name: "جمعتنا", teams: ["البرق", "الموج"] };
    for (const changed of [{ ...valid, ownerId: "forged-owner" }, { ...valid, points: 9 },
      { ...valid, teams: ["البرق", "الموج", "ثالث"] }, null, []]) {
      expect(() => validateCreate(changed as unknown as Parameters<typeof validateCreate>[0]))
        .toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
    }
  });
  it("replays three frozen Night receipts rather than trusting arbitrary team scores", () => {
    const night = completed();
    const snap = completedSnapshot(night, stable);
    expect(snap.teams).toEqual([
      { shillaTeamId: "s-a", name: "البرق", points: 9, champion: true },
      { shillaTeamId: "s-b", name: "الموج", points: 6, champion: false },
    ]);
    expect(snap.sourceDigests).toHaveLength(3);
    expect(snapshotDigest(snap)).toBe(snapshotDigest(JSON.parse(JSON.stringify(snap))));
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
  it("rejects receipt bytes changed without changing their previously accepted digest", () => {
    const changed = completed();
    changed.games[0].resultReceipt.scores[0].score += 1;
    expect(() => completedSnapshot(changed, stable)).toThrow(expect.objectContaining({ code: "INVALID_NIGHT_RECEIPT" }));
  });
  it.each(["sourceVersion", "matchNumber", "scores", "sourceDigest"] as const)(
    "rejects a receipt missing the approved %s audit evidence", key => {
      const changed = completed();
      delete (changed.games[0].resultReceipt as unknown as Record<string, unknown>)[key];
      expect(() => completedSnapshot(changed, stable)).toThrow(expect.objectContaining({ code: "INVALID_NIGHT_RECEIPT" }));
    });
  it("rejects a source-version contradiction and self-consistent receipts with scores contradicting placements", () => {
    const version = completed(); version.games[0].sourceVersion++;
    expect(() => completedSnapshot(version, stable)).toThrow(expect.objectContaining({ code: "INVALID_NIGHT_RECEIPT" }));
    const changed = completed();
    changed.games[0].resultReceipt.scores.reverse();
    const { digest: _digest, ...unsigned } = changed.games[0].resultReceipt;
    changed.games[0].resultReceipt.digest = jsonDigest(unsigned);
    changed.games[0].resultDigest = changed.games[0].resultReceipt.digest;
    expect(() => completedSnapshot(changed, stable)).toThrow(expect.objectContaining({ code: "INVALID_NIGHT_RECEIPT" }));
  });
  it("accepts canonical complete receipts after JSONB object-key reordering", () => {
    const changed = completed();
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) :
      value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, reorder(item)])) : value;
    for (const slot of changed.games) slot.resultReceipt = reorder(slot.resultReceipt) as typeof slot.resultReceipt;
    expect(completedSnapshot(changed, stable).teams.map(t => t.points)).toEqual([9, 6]);
  });
  it("rejects malformed persisted Night state with a controlled domain error", () => {
    const changed = completed();
    (changed.state as unknown as Record<string, unknown>).teams = { length: 2 };
    expect(() => completedSnapshot(changed, stable)).toThrow(expect.objectContaining({ code: "NIGHT_NOT_ELIGIBLE" }));
  });
  it("rejects unsupported launch games even with otherwise matching receipt records", () => {
    const changed = completed();
    (changed.state.games as string[])[0] = "lightning-quiz";
    (changed.state.results[0].game as string) = "lightning-quiz";
    changed.games[0].gameSlug = "lightning-quiz" as typeof games[number];
    (changed.games[0].resultReceipt.game as string) = "lightning-quiz";
    expect(() => completedSnapshot(changed, stable)).toThrow(expect.objectContaining({ code: "NIGHT_NOT_ELIGIBLE" }));
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
