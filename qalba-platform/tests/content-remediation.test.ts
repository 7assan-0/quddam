import { validateQuestion as validateOrderingQuestion } from "../src/lib/games/ordering/module";
import { validateCase as validateCourtCase } from "../src/lib/games/court/module";
import { orderingCategories } from "../prisma/ordering-questions";
import { courtCategories } from "../prisma/court-cases";
import { describe, expect, it } from "vitest";
import { orderingSamples } from "../prisma/ordering-questions";
import { duplicateOrderingIds } from "../prisma/content-remediations";
import { courtSamples } from "../prisma/court-cases";
import { LETTER_WEIGHTS } from "../src/lib/games/letter-network/module";

describe("content remediation guardrails", () => {
  it("retains 180 ordering challenges and archives the ten known duplicates", () => {
    expect(orderingSamples).toHaveLength(180);
    expect(duplicateOrderingIds.size).toBe(10);
    const actual = orderingSamples.filter((q) => !duplicateOrderingIds.has(q.id));
    expect(actual).toHaveLength(170);
    for (const archived of duplicateOrderingIds) {
      expect(orderingSamples.some((q) => q.id === archived)).toBe(true);
    }
  });

  it("diversifies ordering challenges with a complete answer-key permutation", () => {
    const instructions = orderingSamples.map((q) => q.instruction);
    expect(instructions.filter((x) => x.startsWith("رتب الكلمات وفق الترتيب الهجائي العربي"))).toHaveLength(12);
    expect(instructions.filter((x) => x.startsWith("رتب الكلمات هجائيًا بالعكس"))).toHaveLength(12);
    expect(instructions.filter((x) => x.startsWith("رتب الكلمات من الأقصر"))).toHaveLength(12);
    expect(instructions.filter((x) => x.startsWith("رتب الكلمات من الأطول"))).toHaveLength(12);
    expect(instructions.filter((x) => x.startsWith("رتب الكلمات حسب آخر حرف"))).toHaveLength(12);
    for (const q of orderingSamples) {
      const category = orderingCategories.find(([slug]) => slug === q.categorySlug)?.[1];
      expect(category).toBeTruthy();
      expect(validateOrderingQuestion({ ...q, category: category! })).toBeTruthy();
      const actual = q.items.map((item) => item.correctPosition).sort((a, b) => a - b);
      expect(actual).toEqual(q.items.map((_, i) => i + 1));
      expect(new Set(q.items.map((item) => item.label)).size).toBe(q.items.length);
    }
  });

  it("gives all 180 fictional court cases distinct scenario-specific arguments", () => {
    expect(courtSamples).toHaveLength(180);
    expect(new Set(courtSamples.map((q) => q.scenario)).size).toBe(180);
    expect(courtSamples.every((q) => !q.scenario.includes("هل يحتاج اتفاقًا أوضح مع المجموعة، أم أن الموقف له عذر مقبول؟"))).toBe(true);
    expect(courtSamples.every((q) => q.scenario.includes(`«${q.title}»`))).toBe(true);
    expect(new Set(courtSamples.map((q) => q.prosecutionPrompt)).size).toBe(180);
    expect(new Set(courtSamples.map((q) => q.rebuttalPrompt)).size).toBe(180);
    for (const q of courtSamples) {
      const category = courtCategories.find(([slug]) => slug === q.category)?.[1];
      expect(category).toBeTruthy();
      expect(validateCourtCase({ ...q, category: category! })).toBeTruthy();
      expect(q.prosecutionPrompt).toContain(q.title);
      expect(q.rebuttalPrompt).toContain(q.title);
      expect(q.rebuttalPrompt).toContain("بلا جواب مسبق");
    }
  });

  it("enables all 28 Arabic letters for boards with a minimum of eight questions", () => {
    const letters = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي";
    expect(Object.keys(LETTER_WEIGHTS)).toHaveLength(28);
    expect(new Set(Object.keys(LETTER_WEIGHTS))).toEqual(new Set([...letters]));
    for (const letter of letters) expect(LETTER_WEIGHTS[letter]).toBeGreaterThan(0);
  });
});
