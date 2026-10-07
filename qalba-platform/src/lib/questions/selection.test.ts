import { describe, expect, it } from "vitest";
import { selectQuestion } from "./selection";

const candidates = ["a", "b", "c"].map((id) => ({ id, categoryId: "science", difficulty: "EASY" }));

describe("question selection", () => {
  it("selects unseen questions before prior questions", () => {
    const result = selectQuestion(candidates, [{ questionId: "a", lastPlayedAt: new Date("2026-01-01") }], new Set(), () => 0);
    expect(result?.id).toBe("b");
  });

  it("never repeats a used question within the same session", () => {
    expect(selectQuestion(candidates, [], new Set(["a", "b"]), () => 0)?.id).toBe("c");
    expect(selectQuestion(candidates, [], new Set(["a", "b", "c"]))).toBeNull();
  });

  it("falls back to the least recently played after exhausting fresh content", () => {
    const history = [
      { questionId: "a", lastPlayedAt: new Date("2026-09-01") },
      { questionId: "b", lastPlayedAt: new Date("2026-08-01") },
      { questionId: "c", lastPlayedAt: new Date("2026-09-20") },
    ];
    expect(selectQuestion(candidates, history, new Set())?.id).toBe("b");
  });
});
