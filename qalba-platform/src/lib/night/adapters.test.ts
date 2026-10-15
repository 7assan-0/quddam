import { describe, expect, it } from "vitest";
import { verifyNightOutcome, type NightSource } from "./adapters";
import type { NightGameSlug } from "./catalog";
import type { NightTeamMapping } from "./types";
const mapping: NightTeamMapping[] = [0, 1].map(i => ({ nightTeamId: `night-team-${i}`, sourceTeamId: `source-team-${i}`, name: `فريق ${i}`, position: i }));
function source(game: NightGameSlug = "top-list"): NightSource {
  const count = game === "ordering-challenge" ? 7 : 5;
  const scores = game === "survey-show" ? [90, 30] : [count * 10, count * 5];
  return { id: "source-session", hostId: "owner", status: "COMPLETED", stateVersion: count + 2,
    startedAt: new Date(1000), endedAt: new Date(2000), creditConsumedAt: new Date(1000), gameType: { slug: game },
    teams: mapping.map((m, i) => ({ id: m.sourceTeamId, name: m.name, position: i, score: scores[i] })),
    commands: [{ type: "START", stateVersion: 1 }, ...Array.from({ length: count }, (_, i) => ({ type: "NEXT_ROUND", stateVersion: i + 2 })), { type: "COMPLETE", stateVersion: count + 2 }],
    rankedUses: game === "top-list" ? Array.from({ length: count }, (_, i) => ({ id: `use-${i}`, matchNumber: 1, roundIndex: i, gameRound: { endedAt: new Date(2000) } })) : [],
    orderingUses: game === "ordering-challenge" ? Array.from({ length: count }, (_, i) => ({ id: `use-${i}`, matchNumber: 1, roundIndex: i, endedAt: new Date(2000) })) : [],
    surveyQuestionUses: game === "survey-show" ? Array.from({ length: count }, (_, i) => ({ id: `use-${i}`, matchNumber: 1, roundNumber: i + 1 })) : [],
    state: { schemaVersion: 1, module: game === "top-list" ? "RANKED_LIST" : game === "ordering-challenge" ? "ORDERING" : "SURVEY_BATTLE", phase: "COMPLETED", matchNumber: 1, roundIndex: count - 1, useIds: Array.from({ length: count }, (_, i) => `use-${i}`), teamIds: mapping.map(m => m.sourceTeamId), scores,
      ...(game === "top-list" ? { results: Array.from({ length: count }, (_, i) => ({ round: i + 1, points: [10, 5], found: [1, 1] })) } : game === "ordering-challenge" ? { roundCount: count, results: Array.from({ length: count }, (_, i) => ({ roundNumber: i + 1, metrics: [10, 5].map(totalPoints => ({ totalPoints, exactMatches: 1, perfectBonus: 0, positionError: 2 })), reason: "SUBMITTED", voided: false })) } : { multipliers: [1, 1, 2, 2, 3], roundWinnerId: mapping[0].sourceTeamId }),
    } };
}
function changeState(s: NightSource, data: Record<string, unknown>) { s.state = { ...s.state as object, ...data }; return s; }
describe("server-verified Night completion adapters", () => {
  it.each<NightGameSlug>(["top-list", "ordering-challenge", "survey-show"])("imports only a complete %s result and maps stable team identity", game => {
    const receipt = verifyNightOutcome("owner", game, mapping, source(game));
    expect(receipt).toMatchObject({ game, matchNumber: 1, sourceVersion: source(game).stateVersion, placements: [{ teamIds: ["night-team-0"] }, { teamIds: ["night-team-1"] }] });
    expect(receipt.digest).toMatch(/^[a-f0-9]{64}$/); expect(JSON.stringify(receipt)).not.toMatch(/answers|useIds|RANKED_LIST/);
  });
  it("derives ties from authoritative equal scores", () => {
    const s = source(); s.teams[1].score = 50; changeState(s, { scores: [50, 50], results: Array.from({ length: 5 }, (_, i) => ({ round: i + 1, points: [10, 10], found: [1, 1] })) });
    expect(verifyNightOutcome("owner", "top-list", mapping, s).placements).toEqual([{ teamIds: ["night-team-0", "night-team-1"] }]);
  });
  it.each(["LOBBY", "IN_PROGRESS", "ABANDONED"])("rejects nonfinal source status %s", status => { expect(() => verifyNightOutcome("owner", "top-list", mapping, { ...source(), status })).toThrow(); });
  it("rejects cross-owner, wrong game, unknown team identity, changed name or position", () => {
    expect(() => verifyNightOutcome("other", "top-list", mapping, source())).toThrow();
    expect(() => verifyNightOutcome("owner", "survey-show", mapping, source())).toThrow();
    for (const data of [{ id: "forged" }, { name: "new name" }, { position: 1 }]) { const s = source(); Object.assign(s.teams[0], data); expect(() => verifyNightOutcome("owner", "top-list", mapping, s)).toThrow(); }
  });
  it("rejects missing credit/start/end evidence and unsafe/inconsistent scores", () => {
    for (const field of ["startedAt", "endedAt", "creditConsumedAt"] as const) { const s = source(); s[field] = null; expect(() => verifyNightOutcome("owner", "top-list", mapping, s)).toThrow(); }
    for (const score of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, 999]) { const s = source(); s.teams[0].score = score; expect(() => verifyNightOutcome("owner", "top-list", mapping, s)).toThrow(); }
  });
  it("rejects final-screen-only, shortened, rematch, duplicate/missing rounds and identity contradictions", () => {
    for (const data of [{ phase: "FINAL_RESULTS" }, { matchNumber: 2 }, { roundIndex: 3 }, { schemaVersion: 2 }, { teamIds: mapping.map(m => m.sourceTeamId).reverse() }, { results: [] }, { useIds: Array(5).fill("repeated") }]) expect(() => verifyNightOutcome("owner", "top-list", mapping, changeState(source(), data))).toThrow();
    for (const type of ["END_GAME", "REMATCH"]) { const s = source(); s.commands.splice(1, 0, { type, stateVersion: 1 }); expect(() => verifyNightOutcome("owner", "top-list", mapping, s)).toThrow(); }
    const incomplete = source("survey-show"); incomplete.commands.splice(2, 1); expect(() => verifyNightOutcome("owner", "survey-show", mapping, incomplete)).toThrow();
  });
  it("rejects ordering result totals that do not match canonical Team scores", () => {
    const s = source("ordering-challenge"); const data = s.state as { results: { metrics: { totalPoints: number }[] }[] }; data.results[0].metrics[0].totalPoints++;
    expect(() => verifyNightOutcome("owner", "ordering-challenge", mapping, s)).toThrow();
  });
  it("binds receipt to exact source version and scores for altered replay detection", () => {
    const s = source(), one = verifyNightOutcome("owner", "top-list", mapping, s);
    expect(verifyNightOutcome("owner", "top-list", mapping, structuredClone(s))).toEqual(one);
    s.stateVersion++; s.commands.at(-1)!.stateVersion++; expect(verifyNightOutcome("owner", "top-list", mapping, s).digest).not.toBe(one.digest);
  });
});
