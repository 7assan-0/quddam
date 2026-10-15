import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { socialWords } from "../prisma/core-content";

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
  const bluff = bank("Bluff_13_Remediated_Sourced_Review_Pending.csv");
  const ranked = bank("Ranked_15_Remediated.csv");
  const ordering = bank("Ordering_15_Remediated.csv");
  const court = bank("Court_15_Remediated.csv");

  it("preserves all six editorial supplemental pack counts", () => {
    expect([survey.length, forbidden.length, bluff.length, ranked.length, ordering.length, court.length]).toEqual([26, 52, 13, 15, 15, 15]);
    for (const list of [survey, forbidden, bluff, ranked, ordering, court]) {
      expect(new Set(list.map((item) => item.id)).size).toBe(list.length);
    }
  });
  it("keeps curated survey scoring structural and six distinct answers per candidate", () => {
    for (const item of survey) {
      expect(item.sourceType).toBe("CURATED");
      const answers = JSON.parse(item.answers_json) as Array<{ answer: string; points: number; alternativeAnswers: string[] }>;
      expect(answers).toHaveLength(6);
      expect(new Set(answers.map((answer) => norm(answer.answer))).size).toBe(6);
      expect(answers.reduce((sum, answer) => sum + answer.points, 0)).toBe(100); // authored points, NOT sampled percentages
      answers.forEach((answer) => expect(Array.isArray(answer.alternativeAnswers)).toBe(true));
    }
  });
  it("keeps four distinct restricted clues per new Forbidden Word card", () => {
    for (const item of forbidden) {
      const terms = JSON.parse(item.forbiddenWords) as string[];
      expect(terms).toHaveLength(4);
      expect(new Set(terms.map(norm)).size).toBe(4);
      expect(terms.map(norm)).not.toContain(norm(item.targetWord));
    }
  });
  it("requires staged Bluff references and structurally distinct aliases", () => {
    for (const item of bluff) {
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      const aliases = JSON.parse(item.alternativeCorrectAnswers) as string[];
      expect(Array.isArray(aliases)).toBe(true);
      expect(aliases.map(norm)).not.toContain(norm(item.correctAnswer));
    }
  });
  it("keeps ten individually distinct answers and ten positions per curated Ranked list", () => {
    for (const item of ranked) {
      expect(item.kind).toBe("CURATED");
      const entries = JSON.parse(item.entries_json) as Array<{ rank: number; answer: string }>;
      expect(entries).toHaveLength(10);
      expect(entries.map((entry) => entry.rank)).toEqual([1,2,3,4,5,6,7,8,9,10]);
      expect(new Set(entries.map((entry) => norm(entry.answer))).size).toBe(10);
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
    expect(entries.every(([,words]) => words.length === 5)).toBe(true);
    const words = entries.flatMap(([,words]) => words);
    expect(words).toHaveLength(55);
    expect(new Set(words.map(norm)).size).toBe(55);
  });
});
