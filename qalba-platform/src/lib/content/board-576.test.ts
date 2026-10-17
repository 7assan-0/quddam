import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardExpansionSamples } from "../../../prisma/board-expansion";
import { boardSamples, boardStarterSamples } from "../../../prisma/core-content";
import { auditBank } from "./audit";
import { sourceBanks } from "./source";

const categories = ["general", "saudi", "football", "science", "technology", "cybersecurity"] as const;
const values = [200, 400, 600] as const;
const levels = { 200: "EASY", 400: "MEDIUM", 600: "HARD" } as const;
const canonical = (s: string) => s.normalize("NFKC")
  .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "")
  .replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي")
  .replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/gu, " ").trim().toLocaleLowerCase("ar");
const words = (s: string) => new Set(canonical(s).split(" ").filter(w => w.length > 2));
function overlap(a: string, b: string) {
  const left = words(a), right = words(b);
  return [...left].filter(w => right.has(w)).length / Math.max(1, new Set([...left, ...right]).size);
}
describe("original Board576 editorial expansion, no show-text copying", () => {
  it("keeps all 72 starter IDs stable and adds exactly 504 original candidate rows", () => {
    expect(boardStarterSamples).toHaveLength(72);
    expect(boardExpansionSamples).toHaveLength(504);
    expect(boardSamples).toHaveLength(576);
    expect(boardSamples.slice(0, 72)).toEqual(boardStarterSamples);
    expect(boardSamples.slice(72)).toEqual(boardExpansionSamples);
  });
  it("has six exact 96-question category pools; 32 distinct slots at each grade", () => {
    for (const slug of categories) {
      expect(boardSamples.filter(row => row[0] === slug)).toHaveLength(96);
      expect(boardExpansionSamples.filter(row => row[0] === slug)).toHaveLength(84);
      for (const point of values) {
        const rows = boardSamples.filter(row => row[0] === slug && row[4] === point);
        expect(rows, slug + " " + point).toHaveLength(32);
        expect(rows.every(row => row[3] === levels[point]), slug + " difficulty mismatch").toBe(true);
        expect(boardExpansionSamples.filter(row => row[0] === slug && row[4] === point)).toHaveLength(28);
      }
    }
    expect(new Set(boardSamples.map(row => row[0]))).toEqual(new Set(categories));
  });
  it("rejects exact and punctuation/hamza/diacritic-normalized duplicate prompts across all 576", () => {
    const prompts = boardSamples.map(row => canonical(row[1]));
    expect(new Set(prompts).size).toBe(prompts.length);
    expect(boardSamples.every(row => row[1].trim().length >= 8 && row[2].trim().length > 0)).toBe(true);
    expect(boardSamples.every(row => row[1].length <= 2000 && row[2].length <= 1000)).toBe(true);
  });
  it("guards near-repeated wording that tests the same answer in the same category", () => {
    const found: string[] = [];
    for (let i = 0; i < boardSamples.length; i++) for (let j = i + 1; j < boardSamples.length; j++) {
      const a = boardSamples[i], b = boardSamples[j];
      if (a[0] !== b[0] || canonical(a[2]) !== canonical(b[2])) continue;
      if (overlap(a[1], b[1]) >= 0.35) found.push(a[0] + " => " + a[1] + " | " + b[1]);
    }
    expect(found).toEqual([]);
  });
  it("keeps a row-level 576-question review ledger without fabricated human approval", () => {
    const csv = readFileSync(new URL("../../../content-review/2026-10-17/Board_576_Item_Review.csv", import.meta.url), "utf8");
    const lines = csv.trimEnd().split(/\\r?\\n/);
    expect(lines).toHaveLength(577); // header + one stable-ID row per authored question
    for (let i = 0; i < 576; i++) {
      expect(lines[i + 1].startsWith(`"seed-category-${i + 1}",`)).toBe(true);
      expect(lines[i + 1]).toContain('"PENDING_INDEPENDENT_ITEM_REVIEW"');
      expect(lines[i + 1]).toContain('"PENDING_INDEPENDENT_FACTCHECK"');
      expect(lines[i + 1]).toContain('"NOT_RUN"');
    }
  });
  it("passes the real source validation (not just a synthetic standalone CSV tally)", () => {
    const rows = sourceBanks()["category-board"];
    expect(rows).toHaveLength(576);
    expect(rows.map(row => row.id)).toEqual(Array.from({ length: 576 }, (_, i) => `seed-category-${i + 1}`));
    const audit = auditBank("category-board", rows);
    expect(audit.eligible).toBe(576);
    expect(audit.duplicatesFound).toBe(0);
    expect(audit.errors).toEqual([]);
    expect(audit.warnings.filter(w => w.code === "BOARD_96_BANK_NOT_YET_READY")).toEqual([]);
  });
});
