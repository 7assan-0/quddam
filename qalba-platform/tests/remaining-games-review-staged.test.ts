import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { socialWords } from "../prisma/core-content";
import { bluffSamples } from "../prisma/bluff-questions";
import { validateQuestion as validateBluffQuestion, validateFake } from "../src/lib/games/bluff/module";
import { validateAnswers } from "../src/lib/games/survey-battle/module";
import { validCard } from "../src/lib/games/forbidden-word/module";
import { validateList } from "../src/lib/games/ranked/module";

const directory = new URL("../content-review/2026-10-15/", import.meta.url);

// Structural guard for editorial CSV candidates only: never an approval of facts or game experience.
function csv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\r" || ch === "\n") && !quoted) {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (quoted) throw Error("Unclosed CSV field");
  if (row.length || cell) { row.push(cell); rows.push(row); }
  return rows;
}
function bank(name: string): Array<Record<string, string>> {
  const rows = csv(readFileSync(new URL(name, directory), "utf8"));
  const keys = rows.shift()!;
  return rows.map((row) => {
    expect(row, `${name} column count`).toHaveLength(keys.length);
    return Object.fromEntries(keys.map((key, i) => [key, row[i]]));
  });
}
const norm = (s: string) => s.normalize("NFKC").replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

describe("remaining seven launch games: review-only structural guards", () => {
  const survey = bank("Survey_26_Remediated.csv");
  const forbidden = bank("Forbidden_52_Remediated.csv");
  const hardForbidden = bank("Forbidden_13_Hard_Candidates_Review_Pending.csv");
  const bluff = bank("Bluff_13_Remediated_Sourced_Review_Pending.csv");
  const ranked = bank("Ranked_15_Remediated.csv");
  const ordering = bank("Ordering_15_Remediated.csv");
  const court = bank("Court_15_Remediated.csv");

  it("preserves all six editorial supplemental pack counts", () => {
    expect([survey.length, forbidden.length, bluff.length, ranked.length, ordering.length, court.length]).toEqual([26, 52, 13, 15, 15, 15]);
    expect(hardForbidden).toHaveLength(13);
    for (const list of [survey, forbidden, hardForbidden, bluff, ranked, ordering, court]) {
      expect(new Set(list.map((item) => item.id)).size).toBe(list.length);
    }
  });
  it("keeps curated survey scoring structural and six distinct answers per candidate", () => {
    for (const item of survey) {
      expect(item.sourceType).toBe("CURATED");
      const answers = JSON.parse(item.answers_json) as Array<{ answer: string; points: number; position: number; alternativeAnswers: string[] }>;
      expect(answers).toHaveLength(6);
      expect(new Set(answers.map((answer) => norm(answer.answer))).size).toBe(6);
      expect(answers.reduce((sum, answer) => sum + answer.points, 0)).toBe(100); // authored points, NOT sampled percentages
      answers.forEach((answer) => expect(Array.isArray(answer.alternativeAnswers)).toBe(true));
      expect(validateAnswers(answers)).toBe(true);
    }
  });
  it("keeps four distinct restricted clues per new Forbidden Word card", () => {
    for (const item of [...forbidden, ...hardForbidden]) {
      const terms = JSON.parse(item.forbiddenWords) as string[];
      expect(terms).toHaveLength(4);
      expect(new Set(terms.map(norm)).size).toBe(4);
      expect(terms.map(norm)).not.toContain(norm(item.targetWord));
      expect(validCard({ targetWord: item.targetWord, forbiddenWords: terms })).toBe(true);
    }
  });
  it("keeps proposed hard-card categories distinct and explicitly pending playtest", () => {
    expect(new Set(hardForbidden.map((item) => item.category)).size).toBe(13);
    expect(hardForbidden.every((item) => item.difficulty === "HARD" && item.qa_status.includes("يحتاج اختبار"))).toBe(true);
    const all = [...forbidden, ...hardForbidden].map((item) => norm(item.targetWord));
    expect(new Set(all).size).toBe(65);
  });
  it("requires staged Bluff references and structurally distinct aliases", () => {
    for (const item of bluff) {
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      const aliases = JSON.parse(item.alternativeCorrectAnswers) as string[];
      expect(Array.isArray(aliases)).toBe(true);
      expect(aliases.map(norm)).not.toContain(norm(item.correctAnswer));
      expect(validateBluffQuestion({ question: item.question, correctAnswer: item.correctAnswer, alternativeCorrectAnswers: aliases, explanation: item.explanation || null })).toBe(true);
    }
  });
  it("rejects a false alternate answer in the original narwhal Bluff question", () => {
    expect(bluffSamples).toHaveLength(156);
    const item = bluffSamples.find((question) => question.id === "bluff-seed-oddities-9")!;
    expect(item.alternativeCorrectAnswers).not.toContain("حريش البحر");
    expect(item.alternativeCorrectAnswers).toContain("ناروال");
    expect(() => validateFake("حريش البحر", item, [], [])).not.toThrow();
    expect(() => validateFake("ناروال", item, [], [])).toThrow();
  });
  it("uses two distinct, sourced Bluff replacements instead of repeated chess/CSS definitions", () => {
    const chess = bluffSamples.find((q) => q.id === "bluff-seed-games-1")!;
    const css = bluffSamples.find((q) => q.id === "bluff-seed-technology-4")!;
    expect(chess.question).toContain("لا يملك اللاعب نقلة قانونية");
    expect(chess.correctAnswer).toBe("بات");
    expect(chess.alternativeCorrectAnswers).not.toContain("الفرس");
    expect(css.question).toContain("حجم الخط");
    expect(css.correctAnswer).toBe("font-size");
    expect(css.alternativeCorrectAnswers).not.toContain("أوراق الأنماط المتتالية");
    expect(validateBluffQuestion(chess)).toBe(true);
    expect(validateBluffQuestion(css)).toBe(true);
    const mx = bluff.find((q) => q.id === "bluff-supplement-technology-01")!;
    expect(mx.correctAnswer).toBe("MX");
    expect(mx.question).toContain("سجل DNS");
  });
  it("keeps ten individually distinct answers and ten positions per curated Ranked list", () => {
    for (const item of ranked) {
      expect(item.kind).toBe("CURATED");
      const entries = JSON.parse(item.entries_json) as Array<{ rank: number; answer: string; alternativeAnswers: string[]; points: number; displayValue: string | null }>;
      expect(entries).toHaveLength(10);
      expect(entries.map((entry) => entry.rank)).toEqual([1,2,3,4,5,6,7,8,9,10]);
      expect(new Set(entries.map((entry) => norm(entry.answer))).size).toBe(10);
      expect(validateList({ title: item.title, description: item.description, kind: "CURATED", sourceLabel: item.sourceLabel, sourceUrl: item.sourceUrl || null, sourceDate: null, notes: null, entries })).toBe(true);
    }
  });
  it("keeps ordered item positions and corrects the geography instruction mismatch", () => {
    for (const item of ordering) {
      const entries = JSON.parse(item.items_json) as Array<{ label: string; correctPosition: number }>;
      expect(entries).toHaveLength(4);
      expect(entries.map((entry) => entry.correctPosition)).toEqual([1,2,3,4]);
      if (item.factual === "True") expect(item.sourceUrl).toMatch(/^https:\/\//);
      if (item.id === "ordering-supplement-geography-01") {
        expect(item.instruction).toContain("ابدأ رحلتك");
        expect(entries[3].label).toBe("بدء الرحلة");
      }
    }
  });
  it("keeps Court scenarios structured without treating jury voting as factual answer checking", () => {
    for (const item of court) {
      expect(JSON.parse(item.facts_json)).toBeInstanceOf(Array);
      expect(item.contentRating).toBe("FICTIONAL_PARTY");
      expect(item.prosecutionPrompt).toBeTruthy();
      expect(item.defensePrompt).toBeTruthy();
      expect(item.rebuttalPrompt).toBeTruthy();
    }
  });
  it("records the current Out-of-the-loop baseline without claiming it is sufficient for publication", () => {
    const entries = Object.entries(socialWords);
    expect(entries).toHaveLength(11);
    expect(entries.every(([,words]) => words.length === 15)).toBe(true);
    const words = entries.flatMap(([,words]) => words);
    expect(words).toHaveLength(165);
    expect(new Set(words.map(norm)).size).toBe(165);
    expect(socialWords.food.slice(0, 5)).toEqual(["كبسة", "لقيمات", "فطيرة", "تمر", "شوربة"]);
    expect(socialWords.places.slice(0, 5)).toEqual(["مكتبة", "حديقة", "محطة قطار", "مطار", "متحف"]);
  });
});
