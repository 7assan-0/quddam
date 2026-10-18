import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardSamples } from "../../../prisma/core-content";
import { geographyCandidate } from "../../../prisma/board-expansion/geography-candidate";
import {
  boardCatalog, boardFirstSix, boardSourceReadiness, pointGrades,
  questionsPerGrade, questionsPerCategory, boardCategoryGoal, boardQuestionGoal,
  type BoardAuthoredRow,
} from "../../../prisma/board-expansion/quality-gate";
import { sourceBanks } from "./source";

const gradeDifficulty = { 200: "EASY", 400: "MEDIUM", 600: "HARD" } as const;
const geographyRows: BoardAuthoredRow[] = pointGrades.flatMap(grade =>
  geographyCandidate[String(grade) as keyof typeof geographyCandidate]
    .map(([question, answer]) => ["geography", question, answer, gradeDifficulty[grade], grade] as const)
);
function normalized(text: string) {
  return text.normalize("NFKC")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "")
    .replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/gu, " ").trim().toLocaleLowerCase("ar");
}
const words = (s: string) => new Set(normalized(s).split(" ").filter(word => word.length > 2));
function overlap(a: string, b: string) {
  const x = words(a), y = words(b);
  return [...x].filter(token => y.has(token)).length / Math.max(1, new Set([...x, ...y]).size);
}
const csvRow = (s: string) => [...s.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)]
  .map(item => item[1].replace(/""/g, '"'));

describe("Board27 staged rollout — evidence, quotas and publication isolation", () => {
  it("uses exactly the seeded names and 27 unique category slugs", () => {
    const seedSource = readFileSync(new URL("../../../prisma/seed.ts", import.meta.url), "utf8");
    const categories = seedSource.match(/const categoryNames = \[([\s\S]*?)\];/);
    const slugs = seedSource.match(/const slugs = \[([\s\S]*?)\];/);
    expect(categories).not.toBeNull();
    expect(slugs).not.toBeNull();
    const parseQuoted = (s: string) => [...s.matchAll(/"([^"]+)"/g)].map(x => x[1]);
    expect(boardCatalog.map(([, title]) => title)).toEqual(parseQuoted(categories![1]));
    expect(boardCatalog.map(([slug]) => slug)).toEqual(parseQuoted(slugs![1]));
    expect(new Set(boardCatalog.map(([slug]) => slug)).size).toBe(27);
    expect(boardCategoryGoal).toBe(27);
    expect(boardQuestionGoal).toBe(2592);
    expect(questionsPerCategory).toBe(96);
  });

  it("recognizes the first six authored 96-item pools without inventing readiness for 21 others", () => {
    const result = boardSourceReadiness(boardSamples);
    expect(result.unknownSlugs).toEqual([]);
    expect(result.completeCount).toBe(6);
    expect(result.incompleteCount).toBe(21);
    expect(result.totalAuthored).toBe(576);
    expect(result.categories.filter(category => category.complete).map(category => category.slug).sort())
      .toEqual([...boardFirstSix].sort());
    for (const category of result.categories.filter(x => !x.complete)) {
      expect(category.missing).toBe(96);
      expect(category.perGrade.map(grade => grade.needed)).toEqual([32, 32, 32]);
    }
  });

  it("stages exactly 96 geography questions with stable point and difficulty quotas", () => {
    expect(geographyRows).toHaveLength(96);
    for (const grade of pointGrades) {
      const rows = geographyRows.filter(row => row[4] === grade);
      expect(rows).toHaveLength(questionsPerGrade);
      expect(rows.every(row => row[0] === "geography" && row[3] === gradeDifficulty[grade])).toBe(true);
    }
    const report = boardSourceReadiness([...boardSamples, ...geographyRows]);
    expect(report.unknownSlugs).toEqual([]);
    expect(report.completeCount).toBe(7);
    expect(report.incompleteCount).toBe(20);
    expect(report.totalAuthored).toBe(672);
  });

  it("rejects empty prompts, answer leakage, exact duplicate or repeated-same-answer clue patterns", () => {
    const rows = [...boardSamples, ...geographyRows] as BoardAuthoredRow[];
    const prompts = rows.map(row => normalized(row[1]));
    expect(new Set(prompts).size).toBe(prompts.length);
    for (const [slug, question, answer] of geographyRows) {
      expect(slug).toBe("geography");
      expect(question.trim().length).toBeGreaterThanOrEqual(12);
      expect(answer.trim().length).toBeGreaterThan(0);
      expect(question.length).toBeLessThanOrEqual(2000);
      expect(answer.length).toBeLessThanOrEqual(1000);
      if (normalized(answer).length >= 5) {
        expect(normalized(question), "Answer leaked: " + question).not.toContain(normalized(answer));
      }
    }
    const collisions: string[] = [];
    for (let i = 0; i < geographyRows.length; i++) {
      for (let j = i + 1; j < geographyRows.length; j++) {
        const a = geographyRows[i], b = geographyRows[j];
        if (normalized(a[2]) === normalized(b[2]) && overlap(a[1], b[1]) >= 0.35) {
          collisions.push(a[1] + " | " + b[1]);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it("has a synchronized per-question ledger without inventing an editor, source, or pilot", () => {
    const csv = readFileSync(
      new URL("../../../content-review/2026-10-18/Board_Geography_96_Review.csv", import.meta.url), "utf8",
    );
    const lines = csv.trimEnd().split(/\r?\n/);
    expect(lines).toHaveLength(97);
    const header = lines[0].replace(/"/g, "").split(",");
    expect(header).toContain("verification_reference");
    expect(header).toContain("alternate_answers_review");
    const rows = lines.slice(1).map(csvRow);
    for (let i = 0; i < geographyRows.length; i++) {
      const row = rows[i], authored = geographyRows[i];
      expect(row).toHaveLength(header.length);
      expect(row[0]).toBe("geo-draft-" + String(i + 1).padStart(3, "0"));
      expect(row.slice(1, 6)).toEqual([authored[0], String(authored[4]), authored[3], authored[1], authored[2]]);
      expect(row.slice(6, 11)).toEqual([
        "PENDING_INDEPENDENT_FACTCHECK", "PENDING_INDEPENDENT_ITEM_REVIEW",
        "NOT_RUN", "NOT_RUN", "PENDING",
      ]);
      expect(row.slice(11)).toEqual(["", "", ""]);
    }
  });

  it("does not silently publish Geography or alter the authorized seed or live Board36 engine", () => {
    const published = sourceBanks()["category-board"];
    expect(published).toHaveLength(576);
    expect(published.every(row => row.categorySlug !== "geography")).toBe(true);
    expect(published.every(row => row.id.startsWith("seed-category-"))).toBe(true);
    expect(published.map(row => row.id)).toEqual(
      Array.from({ length: 576 }, (_, i) => "seed-category-" + (i + 1)),
    );
  });
});
