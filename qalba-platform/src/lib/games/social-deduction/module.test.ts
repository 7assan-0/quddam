import { describe, expect, it } from "vitest";
import { advanceTurn, beginDiscussion, beginVoting, GUESS_TIMER_SECONDS, guessResult, initialState, normalizeArabic, pause, resolveBallot, resume,
  startRound, timeoutGuess, validateVote } from "./module";
const players = ["a", "b", "c", "d"];
const ready = () => startRound(initialState(30), players);
const voting = () => beginVoting(beginDiscussion(ready(), 1000));
describe("خارج الجو: state machine", () => {
  it("rejects player counts outside 3–12", () => {
    expect(() => startRound(initialState(30), ["a", "b"])).toThrow("٣ إلى ١٢");
    expect(() => startRound(initialState(30), Array.from({ length: 13 }, (_, i) => String(i)))).toThrow();
  });
  it("begins with one turn per player, then voting", () => {
    let state = beginDiscussion(ready(), 1000);
    for (let i = 1; i < 4; i++) { state = advanceTurn(state, 4, 2000 + i); expect(state.turnIndex).toBe(i); }
    expect(advanceTurn(state, 4, 5000).phase).toBe("VOTING");
  });
  it("rejects voting and turn changes in illegal states", () => {
    expect(() => validateVote(ready(), "a", "b", players)).toThrow();
    expect(() => advanceTurn(ready(), 4, 2000)).toThrow();
    expect(() => resume(ready(), 0)).toThrow();
    expect(() => beginDiscussion(beginDiscussion(ready(), 0), 0)).toThrow();
  });
  it("pauses and resumes from server time without consuming paused duration", () => {
    const active = beginDiscussion(ready(), 1000); const stopped = pause(active, 13_000);
    expect(stopped.remainingMs).toBe(18_000); expect(stopped.deadlineAt).toBeNull();
    const resumed = resume(stopped, 133_000);
    expect(new Date(resumed.deadlineAt!).getTime()).toBe(151_000);
  });
  it("does not allow a vote for oneself, an outsider candidate, or unknown ID", () => {
    expect(() => validateVote(voting(), "a", "a", players)).toThrow();
    expect(() => validateVote({ ...voting(), candidates: ["a", "b"] }, "c", "d", players)).toThrow();
    expect(() => validateVote(voting(), "unknown", "a", players)).toThrow();
    expect(() => validateVote(voting(), "a", "b", players)).not.toThrow();
  });
  it("finds the unique leader and gives the outsider a final guess", () => {
    const state = resolveBallot(voting(), ["b", "b", "b", "a"], "b", 1000);
    expect(state).toMatchObject({ phase: "OUTSIDER_GUESS", suspectedId: "b", winner: null });
    expect(new Date(state.deadlineAt!).getTime()).toBe(1000 + GUESS_TIMER_SECONDS * 1000);
    expect(state.tally?.find(t => t.targetId === "b")?.count).toBe(3);
  });
  it("awards the outsider a win when another player is accused", () => {
    expect(resolveBallot(voting(), ["c", "c", "c", "a"], "b", 1000)).toMatchObject({ phase: "RESULTS", winner: "OUTSIDER", reason: "WRONG_SUSPECT" });
  });
  it("uses a deterministic runoff on ties and never randomly eliminates", () => {
    const first = resolveBallot(voting(), ["a", "a", "b", "b"], "b", 1000);
    expect(first).toMatchObject({ phase: "RUNOFF_VOTING", ballot: 2, candidates: ["a", "b"] });
    const second = resolveBallot(first, ["a", "a", "b", "b"], "b", 1000);
    expect(second.ballot).toBe(3);
    const final = resolveBallot(second, ["a", "a", "b", "b"], "b", 1000);
    expect(final).toMatchObject({ phase: "RESULTS", winner: "OUTSIDER", reason: "UNRESOLVED_TIE", suspectedId: null });
  });
  it("awards the outsider a win on no votes", () => {
    expect(resolveBallot(voting(), [], "b", 1000)).toMatchObject({ phase: "RESULTS", winner: "OUTSIDER", reason: "UNRESOLVED_TIE" });
  });
  it("awards players victory after an incorrect final guess", () => {
    const state = resolveBallot(voting(), ["b", "b", "b", "a"], "b", 1000);
    expect(guessResult(state, "مطار", ["متحف"], 2000)).toMatchObject({ winner: "PLAYERS", phase: "RESULTS" });
  });
  it("accepts safe Arabic spelling variants, alternatives and diacritics", () => {
    expect(normalizeArabic("  إِضاءة  ")).toBe(normalizeArabic("اضاءه"));
    const state = resolveBallot(voting(), ["b", "b", "b", "a"], "b", 1000);
    expect(guessResult(state, "إضاءة", ["مصباح", "اضاءه"], 2000).winner).toBe("OUTSIDER");
    expect(() => guessResult(ready(), "مصباح", ["مصباح"], 2000)).toThrow();
  });
  it("starts a rematch in private role reveal with no prior tally or winner", () => {
    const old = { ...resolveBallot(voting(), ["c", "c", "c", "b"], "b", 1000), phase: "COMPLETED" as const };
    expect(startRound(old, players)).toMatchObject({ phase: "ROLE_REVEAL", tally: null, winner: null, suspectedId: null, ballot: 0 });
  });
  it("preserves the final guess countdown while paused and resumed", () => {
    const guessing = resolveBallot(voting(), ["b", "b", "b", "a"], "b", 1000);
    const stopped = pause(guessing, 11_000);
    expect(stopped).toMatchObject({ phase: "PAUSED", pausedPhase: "OUTSIDER_GUESS", deadlineAt: null, remainingMs: 20_000 });
    const resumed = resume(stopped, 100_000);
    expect(new Date(resumed.deadlineAt!).getTime()).toBe(120_000);
    expect(() => timeoutGuess(resumed, 119_999)).toThrow("لم تنتهِ");
    expect(timeoutGuess(resumed, 120_000)).toMatchObject({ phase: "RESULTS", winner: "PLAYERS", reason: "GUESS_TIMEOUT" });
  });
  it("rejects a late guess and an early host timeout; resolves expiry only once", () => {
    const guessing = resolveBallot(voting(), ["b", "b", "b", "a"], "b", 1000);
    expect(() => guessResult(guessing, "متحف", ["متحف"], 31_000)).toThrow("انتهت مهلة");
    expect(() => pause(guessing, 31_000)).toThrow("انتهت مهلة");
    expect(() => timeoutGuess(guessing, 30_999)).toThrow("لم تنتهِ");
    const result = timeoutGuess(guessing, 31_000);
    expect(result).toMatchObject({ phase: "RESULTS", winner: "PLAYERS", reason: "GUESS_TIMEOUT", deadlineAt: null });
    expect(() => timeoutGuess(result, 31_001)).toThrow("غير متاح");
  });
  it("accepts a correct guess before the server deadline", () => {
    const guessing = resolveBallot(voting(), ["b", "b", "b", "a"], "b", 1000);
    expect(guessResult(guessing, "  إِضاءة ", ["اضاءه"], 30_999)).toMatchObject({ phase: "RESULTS", winner: "OUTSIDER", reason: "CORRECT_GUESS" });
  });
});
