import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardSamples } from "../../../prisma/core-content";
import { geographyCandidate } from "../../../prisma/board-expansion/geography-candidate";
import { currenciesCandidate } from "../../../prisma/board-expansion/currencies-candidate";
import { ownerBoardCatalogProposal } from "../../../prisma/board-expansion/owner-catalog-proposal";
import { sourceBanks } from "./source";
import { sportsCandidate } from "../../../prisma/board-expansion/sports-candidate";
import { historyCandidate } from "../../../prisma/board-expansion/history-candidate";
import { arabicCandidate } from "../../../prisma/board-expansion/arabic-candidate";
import { cultureCandidate } from "../../../prisma/board-expansion/culture-candidate";
import { foodCandidate } from "../../../prisma/board-expansion/food-candidate";
import { placesCandidate } from "../../../prisma/board-expansion/places-candidate";
import { animalsCandidate } from "../../../prisma/board-expansion/animals-candidate";

const packs = {
  sports: sportsCandidate,
  history: historyCandidate,
  arabic: arabicCandidate,
  culture: cultureCandidate,
  food: foodCandidate,
  places: placesCandidate,
  animals: animalsCandidate,
} as const;
const grades = [200, 400, 600] as const;
const labels = { 200: "EASY", 400: "MEDIUM", 600: "HARD" } as const;
const normalized = (value: string) => value.normalize("NFKC")
  .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "")
  .replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي")
  .replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/gu, " ").trim().toLocaleLowerCase("ar");
const rows = Object.entries(packs).flatMap(([slug, pack]) => grades.flatMap(grade =>
  pack[String(grade) as "200" | "400" | "600"].map(([question, answer], i) =>
    ({ slug, grade, question, answer, id: `${slug}-${grade}-${String(i + 1).padStart(3, "0")}` })
  )
));
const parseCsvRow = (line: string) => [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(m => m[1].replace(/""/g, '"'));

describe("Seven additional knowledge banks — draft-only quality gates", () => {
  it("contains exactly seven complete banks with 96 questions and 32 items per level each", () => {
    expect(Object.keys(packs).sort()).toEqual(["animals", "arabic", "culture", "food", "history", "places", "sports"]);
    expect(rows).toHaveLength(672);
    for (const [slug, pack] of Object.entries(packs)) {
      expect(grades.reduce((sum, grade) => sum + pack[String(grade) as "200" | "400" | "600"].length, 0), slug).toBe(96);
      for (const grade of grades) {
        expect(pack[String(grade) as "200" | "400" | "600"]).toHaveLength(32);
      }
    }
  });

  it("has no normalized duplicate prompts within these packs or against existing/candidate banks", () => {
    const geography = grades.flatMap(grade => geographyCandidate[String(grade) as "200" | "400" | "600"].map(row => normalized(row[0])));
    const currencies = grades.flatMap(grade => currenciesCandidate[String(grade) as "200" | "400" | "600"].map(row => normalized(row[0])));
    const all = [
      ...boardSamples.map(row => normalized(row[1])),
      ...geography,
      ...currencies,
      ...rows.map(row => normalized(row.question)),
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  it("does not reveal long answers in their own prompts and has no empty/oversized content", () => {
    for (const row of rows) {
      expect(row.question.trim().length, row.id).toBeGreaterThanOrEqual(12);
      expect(row.answer.trim().length, row.id).toBeGreaterThan(0);
      expect(row.question.length, row.id).toBeLessThanOrEqual(2000);
      expect(row.answer.length, row.id).toBeLessThanOrEqual(1000);
      if (normalized(row.answer).length >= 9) {
        expect(normalized(row.question), row.id).not.toContain(normalized(row.answer));
      }
    }
  });

  it("disambiguates original 2015 Arabic coffee UNESCO inscription from its 2024 Jordan expansion", () => {
    const [prompt, answer] = cultureCandidate["400"][0];
    expect(prompt).toContain("الأردن");
    expect(prompt).toContain("2015");
    expect(answer).toBe("2024");
    expect(prompt).not.toBe("في أي سنة أدرجت اليونسكو القهوة العربية ضمن التراث الثقافي غير المادي؟");
  });
  it("keeps animal taxonomy question aligned with its answer and coffee dates unambiguous", () => {
    const [animalPrompt, animalAnswer] = animalsCandidate["600"][2];
    expect(animalPrompt).toContain("مجموعة كبرى");
    expect(animalPrompt).not.toContain("نوع الهيكل");
    expect(animalAnswer).toBe("كلابيات القرون");
    const [cucumberQuestion, cucumberAnswer] = animalsCandidate["600"][7];
    expect(cucumberQuestion).not.toContain("ما السائل");
    expect(cucumberQuestion).toContain("يطرحه");
    expect(cucumberAnswer).toBe("بعض أعضائه الداخلية");
    const [narwhalQuestion, narwhalAnswer] = animalsCandidate["600"][11];
    expect(narwhalQuestion).toContain("ذكر النروال");
    expect(narwhalAnswer).toBe("الناب العلوي الأيسر");
    const [coffeePrompt, coffeeAnswer] = cultureCandidate["400"][0];
    expect(coffeePrompt).toContain("2015");
    expect(coffeePrompt).toContain("الأردن");
    expect(coffeeAnswer).toBe("2024");
  });
  it("has a synchronized 672-row item review ledger with every editorial decision still pending", () => {
    const csv = readFileSync(new URL("../../../content-review/2026-10-18/Board_Knowledge_7x96_Review.csv", import.meta.url), "utf8");
    const lines = csv.trimEnd().split(/\r?\n/);
    expect(lines).toHaveLength(673);
    const header = parseCsvRow(lines[0]);
    expect(header).toHaveLength(16);
    expect(header).toContain("source_reference_for_reviewer");
    expect(header).toContain("factual_review");
    expect(header).toContain("difficulty_pilot");
    for (let i = 0; i < rows.length; i++) {
      const record = parseCsvRow(lines[i + 1]);
      const row = rows[i];
      expect(record).toHaveLength(header.length);
      expect(record[0]).toBe(row.id);
      expect(record.slice(1, 6)).toEqual([row.slug, String(row.grade), labels[row.grade], row.question, row.answer]);
      expect(record[7]).toMatch(/^https:\/\//);
      expect(record.slice(8, 12)).toEqual([
        "PENDING_INDEPENDENT_FACTCHECK", "PENDING_INDEPENDENT_ITEM_REVIEW", "NOT_RUN", "NOT_RUN"
      ]);
      expect(record[12]).toBe("");
      expect(record[13]).toBe("");
      expect(record[14]).toBe("NO_EXTERNAL_IMAGES_ADDED");
    }
  });

  it("uses seven already registered unique Board categories without changing the current 576-question playable source", () => {
    expect(ownerBoardCatalogProposal).toHaveLength(27);
    for (const slug of Object.keys(packs)) {
      expect(ownerBoardCatalogProposal.filter(([registeredSlug]) => registeredSlug === slug), slug).toHaveLength(1);
    }
    expect(sourceBanks()["category-board"]).toHaveLength(576);
    expect(sourceBanks()["category-board"].some(row => Object.keys(packs).includes(row.categoryId))).toBe(false);
    const seed = readFileSync(new URL("../../../prisma/seed.ts", import.meta.url), "utf8");
    const core = readFileSync(new URL("../../../prisma/core-content.ts", import.meta.url), "utf8");
    for (const file of [seed, core]) {
      expect(file).not.toContain("sports-candidate");
      expect(file).not.toContain("history-candidate");
      expect(file).not.toContain("arabic-candidate");
      expect(file).not.toContain("culture-candidate");
      expect(file).not.toContain("food-candidate");
      expect(file).not.toContain("places-candidate");
      expect(file).not.toContain("animals-candidate");
    }
  });
});
