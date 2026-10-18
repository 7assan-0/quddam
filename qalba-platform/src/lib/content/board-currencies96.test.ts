import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardSamples } from "../../../prisma/core-content";
import { geographyCandidate } from "../../../prisma/board-expansion/geography-candidate";
import { currenciesCandidate } from "../../../prisma/board-expansion/currencies-candidate";
import { ownerBoardCatalogProposal, currenciesEditorialContract } from "../../../prisma/board-expansion/owner-catalog-proposal";
import { sourceBanks } from "./source";

const grades = [200, 400, 600] as const;
const difficulties = { 200: "EASY", 400: "MEDIUM", 600: "HARD" } as const;
type Entry = readonly [string, string];
const rowsFor = (pack: { readonly "200": readonly Entry[]; readonly "400": readonly Entry[]; readonly "600": readonly Entry[] }) =>
  grades.flatMap(grade => pack[String(grade) as "200" | "400" | "600"].map(([question, answer]) =>
    ["currencies", question, answer, difficulties[grade], grade] as const));
const normalized = (value: string) => value.normalize("NFKC")
  .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "")
  .replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي")
  .replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/gu, " ").trim().toLocaleLowerCase("ar");
const parsed = (s: string) => [...s.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(x => x[1].replace(/""/g, '"'));
const words = (s: string) => new Set(normalized(s).split(" ").filter(w => w.length > 2));
function overlap(a: string, b: string) {
  const left = words(a), right = words(b);
  return [...left].filter(w => right.has(w)).length / Math.max(1, new Set([...left, ...right]).size);
}

describe("Owner-selected Currencies96 — unpublished candidate quality gates", () => {
  const rows = rowsFor(currenciesCandidate);
  it("authors 96 nonempty rows with exactly 32 items per point-value and consistent tier label", () => {
    expect(rows).toHaveLength(96);
    for (const grade of grades) {
      const group = rows.filter(row => row[4] === grade);
      expect(group).toHaveLength(32);
      expect(group.every(row => row[3] === difficulties[grade] && row[0] === "currencies")).toBe(true);
    }
    for (const [, question, answer] of rows) {
      expect(question.trim().length).toBeGreaterThanOrEqual(15);
      expect(answer.trim().length).toBeGreaterThan(0);
      expect(question.length).toBeLessThanOrEqual(2000);
      expect(answer.length).toBeLessThanOrEqual(1000);
      if (normalized(answer).length >= 5) {
        expect(normalized(question), "Answer leaked verbatim in: " + question).not.toContain(normalized(answer));
      }
    }
  });
  it("prevents normalized duplicates across starter, Geography and Currency candidates", () => {
    const geo = grades.flatMap(grade => geographyCandidate[String(grade) as "200" | "400" | "600"]);
    const allPrompts = [
      ...boardSamples.map(row => normalized(row[1])),
      ...geo.map(row => normalized(row[0])),
      ...rows.map(row => normalized(row[1])),
    ];
    expect(new Set(allPrompts).size).toBe(allPrompts.length);
    const similar: string[] = [];
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
      if (normalized(rows[i][2]) === normalized(rows[j][2]) && overlap(rows[i][1], rows[j][1]) >= 0.35)
        similar.push(rows[i][1] + " / " + rows[j][1]);
    }
    expect(similar).toEqual([]);
  });
  it("keeps ISO 4217 answers distinct and catches new-versus-stale code regressions", () => {
    const medium = currenciesCandidate["400"];
    const hard = currenciesCandidate["600"];
    const isoMedium = medium.map(([, answer]) => answer);
    const hardCodes = hard.map(([question]) => question.match(/\b[A-Z]{3}\b/u)?.[0]);
    expect(isoMedium.every(code => /^[A-Z]{3}$/.test(code))).toBe(true);
    expect(hardCodes.every(code => code && /^[A-Z]{3}$/.test(code))).toBe(true);
    expect(new Set([...isoMedium, ...hardCodes]).size).toBe(64);
    expect(hard.find(([question]) => question.includes("SLE"))?.[1]).toBe("الليون");
    expect(medium.find(([question]) => question.includes("جورجيا"))?.[1]).toBe("GEL");
    expect(rows.some((row) => row[1].includes("سعر الصرف") || row[1].includes("اليوم مقابل"))).toBe(false);
    expect(currenciesEditorialContract.avoidLiveExchangeRates).toBe(true);
  });
  it("matches a 96-entry ledger with no fabricated reviewer or approval", () => {
    const csv = readFileSync(new URL("../../../content-review/2026-10-18/Board_Currencies_96_Review.csv", import.meta.url), "utf8");
    const lines = csv.trimEnd().split(/\r?\n/);
    expect(lines).toHaveLength(97);
    const heading = parsed(lines[0]);
    expect(heading).toContain("source_reference_for_reviewer");
    expect(heading).toContain("proposed_answer_variants_not_approved");
    for (let i = 0; i < rows.length; i++) {
      const columns = parsed(lines[i + 1]);
      const authored = rows[i];
      expect(columns).toHaveLength(heading.length);
      expect(columns[0]).toBe("currency-draft-" + String(i + 1).padStart(3, "0"));
      expect(columns.slice(1, 6)).toEqual([authored[0], String(authored[4]), authored[3], authored[1], authored[2]]);
      expect(columns[7]).toContain("https://www.iban.com/currency-codes");
      expect(columns.slice(8, 12)).toEqual([
        "PENDING_INDEPENDENT_FACTCHECK", "PENDING_INDEPENDENT_ITEM_REVIEW", "NOT_RUN", "NOT_RUN"
      ]);
      expect(columns[12]).toBe("");
      expect(columns[13]).toBe("");
      expect(columns[14]).toBe("NO_EXTERNAL_IMAGES_ADDED");
    }
  });
  it("is the unique 27th owner-approved category, with no new live question or seed", () => {
    expect(ownerBoardCatalogProposal).toHaveLength(27);
    expect(ownerBoardCatalogProposal.filter(([slug, title]) => slug === "currencies" && title === "عملات")).toHaveLength(1);
    expect(sourceBanks()["category-board"]).toHaveLength(576);
    expect(sourceBanks()["category-board"].some(row => row.categoryId === "currencies")).toBe(false);
    const seed = readFileSync(new URL("../../../prisma/seed.ts", import.meta.url), "utf8");
    expect(seed).not.toContain("currencies-candidate");
    expect(readFileSync(new URL("../../../prisma/core-content.ts", import.meta.url), "utf8")).not.toContain("currencies-candidate");
  });
});
