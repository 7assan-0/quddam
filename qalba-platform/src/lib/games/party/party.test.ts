import { describe, expect, it } from "vitest";
import { modules } from "./registry";
import { hasRoute } from "./letter-battle";
import type { PartySlug, PartyState } from "./types";

const teams = ["team-a", "team-b"], players = ["p1", "p2", "p3"];
function state(slug: PartySlug, options: unknown = null): PartyState { return { schemaVersion: 1, slug, cards: Array.from({ length: slug === "letter-battle" ? 17 : 2 }, (_, i) => ({ id: `q${i}`, question: "سؤال", answer: slug === "fastest-mind" ? "صح" : "جواب", alternativeAnswers: [], type: "TEXT", options, pointValue: 100 })),
  index: 0, phase: slug === "letter-battle" ? "BOARD" : slug === "bluff" ? "SUBMIT" : slug === "party-court" ? "ARGUE" : "QUESTION", revealed: false,
  teamIds: teams, playerIds: players, timerSeconds: 30, deadlineAt: null, remainingMs: 30000, turn: 0,
  owners: Array(16).fill(null), selected: null, found: [], strikes: 0, fakes: {}, votes: {}, clues: [], winnerId: null, lastCapture: null }; }
describe("independent party rules", () => {
  it("detects only connected letter routes and supports capture undo", () => {
    const board = state("letter-battle", { letter: "ج" }); const engine = modules["letter-battle"];
    const display = engine.project(board, true); expect((display.cards[7].options as { letter: string }).letter).toBe("ج"); expect(display.cards[7].answer).toBe("");
    let current = engine.decide(board, { type: "OPEN", index: 0 }).state;
    current = engine.decide(current, { type: "CAPTURE", teamId: teams[0] }).state;
    expect(current.owners[0]).toBe(teams[0]); expect(board.owners[0]).toBeNull();
    current = engine.decide(current, { type: "UNDO" }).state; expect(current.owners[0]).toBeNull();
    const owners = Array(16).fill(null); [0, 4, 8, 12].forEach(i => owners[i] = teams[0]); expect(hasRoute(owners, teams[0], true)).toBe(true);
    owners[8] = null; expect(hasRoute(owners, teams[0], true)).toBe(false);
  });
  it("scores a convincing fake and correct votes once", () => {
    const engine = modules.bluff; let current = state("bluff");
    for (const id of players) current = engine.decide(current, { type: "FAKE", playerId: id, value: `تمويه ${id}` }).state;
    current = engine.decide(current, { type: "VOTING" }).state;
    current = engine.decide(current, { type: "VOTE", playerId: "p1", value: "correct" }).state;
    current = engine.decide(current, { type: "VOTE", playerId: "p2", value: "p1" }).state;
    current = engine.decide(current, { type: "VOTE", playerId: "p3", value: "correct" }).state;
    expect(engine.decide(current, { type: "RESULT" }).scores).toEqual([{ playerId: "p1", delta: 2, reason: "كشف الإجابة" }, { playerId: "p1", delta: 1, reason: "إجابة مقنعة" }, { playerId: "p3", delta: 2, reason: "كشف الإجابة" }]);
    expect(() => engine.decide(current, { type: "VOTE", playerId: "p1", value: "correct" })).toThrow();
  });
  it("awards fast correct answers and rejects a late answer", () => {
    const engine = modules["fastest-mind"]; const current = state("fastest-mind");
    expect(engine.decide(current, { type: "ANSWER", teamId: teams[0], value: "صح" }).scores?.[0].delta).toBe(100);
    current.deadlineAt = new Date(Date.now() - 1000).toISOString(); expect(() => engine.decide(current, { type: "ANSWER", teamId: teams[0], value: "صح" })).toThrow();
  });
  it("hides ranked entries and awards their configured values", () => {
    const engine = modules["top-list"]; const current = state("top-list", [{ text: "تمر", value: 80 }, { text: "شاي", value: 40 }]);
    expect((engine.project(current, true).cards[0].options as { text: string }[])[0].text).toBe("؟");
    const result = engine.decide(current, { type: "GUESS", teamId: teams[0], value: "تمر" }); expect(result.scores?.[0].delta).toBe(80);
    expect(() => engine.decide(result.state, { type: "GUESS", teamId: teams[0], value: "تمر" })).toThrow();
  });
  it("rejects restricted clues and keeps the TV secret", () => {
    const engine = modules["secret-word"]; const current = state("secret-word", { forbidden: ["كوب"] });
    expect(() => engine.decide(current, { type: "CLUE", value: "كوب" })).toThrow();
    expect(engine.project(current, true).cards[0].answer).toBe("");
    expect(engine.decide(current, { type: "JUDGE", teamId: teams[0], value: "correct" }).scores?.[0].delta).toBe(100);
  });
  it("tracks strikes, steals and round multipliers", () => {
    const engine = modules["survey-show"]; let current = state("survey-show", [{ text: "مفاتيح", value: 40 }]);
    for (let i = 0; i < 3; i++) current = engine.decide(current, { type: "GUESS", teamId: teams[0], value: "خطأ" }).state;
    expect(current.phase).toBe("STEAL"); const result = engine.decide(current, { type: "GUESS", teamId: teams[1], value: "مفاتيح" }); expect(result.scores?.[0].delta).toBe(40); expect(result.state.phase).toBe("RESULT");
  });
  it("collects court votes then awards the winning side", () => {
    const engine = modules["party-court"]; let current = engine.decide(state("party-court"), { type: "VOTING" }).state;
    for (const id of players) current = engine.decide(current, { type: "VOTE", playerId: id, value: "defense" }).state;
    const result = engine.decide(current, { type: "RESULT" }); expect(result.state.winnerId).toBe(teams[1]); expect(result.scores?.[0].delta).toBe(100);
  });
});
