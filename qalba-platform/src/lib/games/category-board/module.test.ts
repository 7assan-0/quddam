import { describe, expect, it } from "vitest";
import { BOARD_VALUES, BOARD_TILES_PER_VALUE, BOARD_TOTAL_CELLS, decideBoard, initialBoardState, type BoardState } from "./module";

const now = new Date("2026-01-01T12:00:00.000Z");
function fixture(): BoardState {
  const categories = Array.from({ length: 6 }, (_, index) => ({ id: `c${index}`, title: `فئة ${index}` }));
  const cells = categories.flatMap(category => BOARD_VALUES.flatMap(value =>
    Array.from({ length: BOARD_TILES_PER_VALUE }, (_, slot) => ({
      key: `${category.id}:${value}:${slot + 1}`, categoryId: category.id, value,
      questionId: slot === 0 ? `${category.id}-${value}` : `${category.id}-${value}-${slot + 1}`, completed: false,
    }))));
  return initialBoardState(categories, ["team-a", "team-b"], cells, Object.fromEntries(cells.map((cell) => [cell.questionId,
    { id: cell.questionId, question: "سؤال تجريبي", answer: "صح", type: "TEXT", options: null, explanation: null, imageUrl: null }])));
}
function open() {
  const started = decideBoard(fixture(), { type: "START" }, now).state;
  return decideBoard(started, { type: "OPEN", cellKey: "c0:200:1" }, now).state;
}

describe("Category Board decisions", () => {
  it("requires exact keys for repeated values but accepts the saved legacy 18-cell format", () => {
    const full = decideBoard(fixture(), { type: "START" }, now).state;
    expect(() => decideBoard(full, { type: "OPEN", categoryId: "c0", value: 200 }, now)).toThrow();
    const legacy = { ...full, cells: full.cells.filter(cell => cell.key.endsWith(":1")).map(cell => ({
      ...cell, key: `${cell.categoryId}:${cell.value}`,
    })) };
    const opened = decideBoard(legacy, { type: "OPEN", categoryId: "c0", value: 200 }, now).state;
    expect(opened.active?.questionId).toBe("c0-200");
    expect(opened.cells).toHaveLength(18);
  });
  it("refuses duplicate tile keys, repeated question ids and incomplete buckets before a match starts", () => {
    const full = fixture(), opts = { categories: full.categories, teamIds: full.teamIds,
      snapshots: full.questionSnapshots };
    const make = (cells: BoardState["cells"]) => initialBoardState(opts.categories, opts.teamIds, cells, opts.snapshots);
    const duplicate = structuredClone(full.cells);
    duplicate[1].questionId = duplicate[0].questionId;
    expect(() => make(duplicate)).toThrow();
    const repeatedKey = structuredClone(full.cells);
    repeatedKey[1].key = repeatedKey[0].key;
    expect(() => make(repeatedKey)).toThrow();
    expect(() => make(full.cells.slice(0,18))).toThrow();
  });
  it("awards doubled points exactly once and undo creates the opposite delta", () => {
    let state = open();
    state = decideBoard(state, { type: "USE_POWERUP", slug: "double" }, now, { powerRemaining: 1 }).state;
    const correct = decideBoard(state, { type: "CORRECT" }, now);
    expect(correct.score).toMatchObject({ teamId: "team-a", delta: 400 });
    expect(correct.state.cells[0].completed).toBe(true);
    expect(() => decideBoard(correct.state, { type: "CORRECT" }, now)).toThrow();
    const undo = decideBoard(correct.state, { type: "UNDO" }, now);
    expect(undo.score?.delta).toBe(-400);
    expect(undo.state.active?.questionId).toBe("c0-200");
    expect(undo.state.cells[0].completed).toBe(false);
    expect(decideBoard(undo.state, { type: "UNDO" }, now).refundedPower).toEqual({ teamId: "team-a", slug: "double" });
  });

  it("moves a wrong answer to a steal, and an accepted challenge awards the original team", () => {
    const wrong = decideBoard(open(), { type: "WRONG" }, now);
    expect(wrong.state.active?.phase).toBe("STEAL");
    expect(wrong.state.active?.answeringTeamId).toBe("team-b");
    const challenged = decideBoard(wrong.state, { type: "USE_POWERUP", slug: "challenge" }, now, { powerRemaining: 1 });
    expect(() => decideBoard(challenged.state, { type: "CORRECT" }, now)).toThrow();
    const resolved = decideBoard(challenged.state, { type: "RESOLVE_CHALLENGE", accepted: true }, now);
    expect(resolved.score).toMatchObject({ teamId: "team-a", delta: 200 });
  });

  it("shield blocks a steal and removal requires a valid multiple-choice question", () => {
    const shielded = decideBoard(open(), { type: "USE_POWERUP", slug: "shield" }, now, { powerRemaining: 1 });
    const wrong = decideBoard(shielded.state, { type: "WRONG" }, now);
    expect(wrong.state.active).toBeNull();
    expect(wrong.state.cells[0].completed).toBe(true);
    expect(() => decideBoard(open(), { type: "USE_POWERUP", slug: "remove-two" }, now,
      { powerRemaining: 1, question: { id: "q", question: "تجريبي", type: "TEXT", answer: "صح", options: null, explanation: null, imageUrl: null } })).toThrow();
    const removed = decideBoard(open(), { type: "USE_POWERUP", slug: "remove-two" }, now,
      { powerRemaining: 1, question: { id: "q", question: "تجريبي", type: "MULTIPLE_CHOICE", answer: "صح", options: ["خطأ أ", "صح", "خطأ ب", "خطأ ج"], explanation: null, imageUrl: null } });
    expect(removed.state.active?.removedOptions).toEqual([0, 2]);
  });

  it("persists deadlines and additional time through pause and resume", () => {
    const started = decideBoard(open(), { type: "TIMER_START" }, now).state;
    const extended = decideBoard(started, { type: "USE_POWERUP", slug: "extra-time" }, now,
      { powerRemaining: 1, powerSeconds: 15 }).state;
    expect(extended.active?.deadlineAt).toBe("2026-01-01T12:00:45.000Z");
    const paused = decideBoard(extended, { type: "TIMER_PAUSE" }, new Date(now.getTime() + 5000)).state;
    expect(paused.active?.remainingMs).toBe(40_000);
    expect(paused.active?.deadlineAt).toBeNull();
    expect(decideBoard(paused, { type: "TIMER_START" }, now).state.active?.deadlineAt).toBe("2026-01-01T12:00:40.000Z");
  });

  it("ends only after all 72 distinct cells, then permits undo of the last result", () => {
    let state = decideBoard(fixture(), { type: "START" }, now).state;
    expect(state.cells).toHaveLength(BOARD_TOTAL_CELLS);
    expect(new Set(state.cells.map(cell => cell.questionId)).size).toBe(BOARD_TOTAL_CELLS);
    for (const cell of state.cells) {
      state = decideBoard(state, { type: "OPEN", cellKey: cell.key }, now).state;
      state = decideBoard(state, { type: "SKIP" }, now).state;
    }
    expect(state.completed).toBe(true);
    expect(state.cells.every((cell) => cell.completed)).toBe(true);
    expect(() => decideBoard(state, { type: "OPEN", cellKey: "c0:200:1" }, now)).toThrow();
    expect(decideBoard(state, { type: "UNDO" }, now).state.completed).toBe(false);
  });

  it("freezes a running timer when paused and resumes with exactly the saved time", () => {
    const running = decideBoard(open(), { type: "TIMER_START" }, now).state;
    const paused = decideBoard(running, { type: "PAUSE_GAME" }, new Date(now.getTime() + 5000)).state;
    expect(paused.paused).toBe(true);
    expect(paused.active?.remainingMs).toBe(25_000);
    expect(paused.active?.deadlineAt).toBeNull();
    expect(() => decideBoard(paused, { type: "CORRECT" }, now)).toThrow();
    const resumed = decideBoard(paused, { type: "RESUME_GAME" }, new Date(now.getTime() + 125_000)).state;
    expect(resumed.paused).toBe(false);
    expect(resumed.active?.remainingMs).toBe(25_000);
    expect(resumed.active?.deadlineAt).toBe("2026-01-01T12:02:30.000Z");
  });

  it("audits manual score changes and allows only the latest adjustment to be undone", () => {
    const state = decideBoard(fixture(), { type: "START" }, now).state;
    const edit = decideBoard(state, { type: "EDIT_SCORE", teamId: "team-b", delta: -150 }, now);
    expect(edit.score).toMatchObject({ teamId: "team-b", delta: -150 });
    expect(() => decideBoard(state, { type: "EDIT_SCORE", teamId: "not-a-team", delta: 100 }, now)).toThrow();
    const undo = decideBoard(edit.state, { type: "UNDO" }, now);
    expect(undo.score?.delta).toBe(150);
    expect(() => decideBoard(undo.state, { type: "UNDO" }, now)).toThrow();
  });

  it("ends early with unused cells and prevents further commands", () => {
    const ended = decideBoard(open(), { type: "END_GAME" }, now);
    expect(ended.state.completed).toBe(true);
    expect(ended.state.endedEarly).toBe(true);
    expect(ended.state.cells.every((cell) => !cell.completed)).toBe(true);
    expect(ended.roundEnded).toBe(true);
    expect(() => decideBoard(ended.state, { type: "UNDO" }, now)).toThrow();
    const correction = decideBoard(ended.state, { type: "EDIT_SCORE", teamId: "team-a", delta: 100 }, now);
    expect(correction.score?.delta).toBe(100);
    const reversed = decideBoard(correction.state, { type: "UNDO" }, now);
    expect(reversed.score?.delta).toBe(-100);
    expect(reversed.state.completed).toBe(true);
    expect(reversed.state.endedEarly).toBe(true);
  });
});

describe("Category Board hardening", () => {
  it("restores the original turn and running timer after wrong, including a pause and resume", () => {
    const running = decideBoard(open(), { type: "TIMER_START" }, now).state;
    const wrong = decideBoard(running, { type: "WRONG" }, new Date(now.getTime() + 5_000)).state;
    expect(wrong.active?.phase).toBe("STEAL");
    const paused = decideBoard(wrong, { type: "PAUSE_GAME" }, new Date(now.getTime() + 6_000)).state;
    const resumed = decideBoard(paused, { type: "RESUME_GAME" }, new Date(now.getTime() + 126_000)).state;
    const undone = decideBoard(resumed, { type: "UNDO" }, new Date(now.getTime() + 127_000)).state;
    expect(undone.active?.phase).toBe("QUESTION");
    expect(undone.active?.answeringTeamId).toBe("team-a");
    expect(undone.turnTeamId).toBe("team-a");
    expect(undone.active?.remainingMs).toBe(25_000);
    expect(undone.active?.deadlineAt).toBe("2026-01-01T12:02:32.000Z");
  });

  it("reverses a steal result then the preceding wrong judgment without duplicating score", () => {
    const wrong = decideBoard(open(), { type: "WRONG" }, now).state;
    const steal = decideBoard(wrong, { type: "CORRECT" }, now);
    expect(steal.score?.teamId).toBe("team-b");
    const undoSteal = decideBoard(steal.state, { type: "UNDO" }, now);
    expect(undoSteal.score?.delta).toBe(-200);
    expect(undoSteal.state.active?.phase).toBe("STEAL");
    expect(undoSteal.state.cells[0].completed).toBe(false);
    expect(decideBoard(undoSteal.state, { type: "UNDO" }, now).state.active?.phase).toBe("QUESTION");
  });

  it("refunds a power-up on undo and preserves the earlier wrong judgment", () => {
    const wrong = decideBoard(open(), { type: "WRONG" }, now).state;
    const challenge = decideBoard(wrong, { type: "USE_POWERUP", slug: "challenge" }, now, { powerRemaining: 1 });
    const undo = decideBoard(challenge.state, { type: "UNDO" }, now);
    expect(undo.refundedPower).toEqual({ teamId: "team-a", slug: "challenge" });
    expect(undo.state.active?.phase).toBe("STEAL");
    expect(decideBoard(undo.state, { type: "UNDO" }, now).state.active?.phase).toBe("QUESTION");
  });

  it("rejects late judgments with TIMER_EXPIRED, but allows a host timeout resolution", () => {
    const started = decideBoard(open(), { type: "TIMER_START" }, now).state;
    const late = new Date(now.getTime() + 31_000);
    expect(() => decideBoard(started, { type: "CORRECT" }, late)).toThrowError(expect.objectContaining({ code: "TIMER_EXPIRED" }));
    expect(() => decideBoard(started, { type: "WRONG" }, late)).toThrowError(expect.objectContaining({ code: "TIMER_EXPIRED" }));
    expect(decideBoard(started, { type: "SKIP" }, late).state.cells[0].completed).toBe(true);
  });

  it("rejects illegal transitions and repeat resolution", () => {
    const started = decideBoard(fixture(), { type: "START" }, now).state;
    expect(() => decideBoard(started, { type: "CORRECT" }, now)).toThrow();
    expect(() => decideBoard(started, { type: "RESUME_GAME" }, now)).toThrow();
    const active = decideBoard(started, { type: "OPEN", cellKey: "c0:200:1" }, now).state;
    expect(() => decideBoard(active, { type: "OPEN", cellKey: "c1:200:1" }, now)).toThrow();
    expect(() => decideBoard(active, { type: "USE_POWERUP", slug: "challenge" }, now, { powerRemaining: 1 })).toThrow();
    const done = decideBoard(active, { type: "CORRECT" }, now).state;
    expect(() => decideBoard(done, { type: "WRONG" }, now)).toThrow();
  });
});
