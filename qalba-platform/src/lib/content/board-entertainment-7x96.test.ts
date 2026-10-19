import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardSamples } from "../../../prisma/core-content";
import { geographyCandidate } from "../../../prisma/board-expansion/geography-candidate";
import { currenciesCandidate } from "../../../prisma/board-expansion/currencies-candidate";
import { sportsCandidate } from "../../../prisma/board-expansion/sports-candidate";
import { historyCandidate } from "../../../prisma/board-expansion/history-candidate";
import { arabicCandidate } from "../../../prisma/board-expansion/arabic-candidate";
import { cultureCandidate } from "../../../prisma/board-expansion/culture-candidate";
import { foodCandidate } from "../../../prisma/board-expansion/food-candidate";
import { placesCandidate } from "../../../prisma/board-expansion/places-candidate";
import { animalsCandidate } from "../../../prisma/board-expansion/animals-candidate";
import { moviesCandidate } from "../../../prisma/board-expansion/movies-candidate";
import { seriesCandidate } from "../../../prisma/board-expansion/series-candidate";
import { gamesCandidate } from "../../../prisma/board-expansion/games-candidate";
import { carsCandidate } from "../../../prisma/board-expansion/cars-candidate";
import { peopleCandidate } from "../../../prisma/board-expansion/people-candidate";
import { riddlesCandidate } from "../../../prisma/board-expansion/riddles-candidate";
import { whoAmICandidate } from "../../../prisma/board-expansion/who-am-i-candidate";
import { ownerBoardCatalogProposal } from "../../../prisma/board-expansion/owner-catalog-proposal";
import { sourceBanks } from "./source";

type Pair = readonly [string,string];
type Pack = { readonly "200": readonly Pair[]; readonly "400": readonly Pair[]; readonly "600": readonly Pair[] };
const entertain: Record<string,Pack> = {
  movies: moviesCandidate, series: seriesCandidate, games: gamesCandidate, cars: carsCandidate,
  people: peopleCandidate, riddles: riddlesCandidate, "who-am-i": whoAmICandidate,
};
const earlier: Record<string,Pack> = {
  geography: geographyCandidate, currencies: currenciesCandidate, sports: sportsCandidate,
  history: historyCandidate, arabic: arabicCandidate, culture: cultureCandidate,
  food: foodCandidate, places: placesCandidate, animals: animalsCandidate,
};
const grades = ["200","400","600"] as const;
const difficulty = { "200": "EASY", "400": "MEDIUM", "600": "HARD" };
const rows = Object.entries(entertain).flatMap(([slug,pack]) => grades.flatMap(g =>
  pack[g].map(([question,answer],i) => ({
    id: slug+"-"+g+"-"+String(i+1).padStart(3,"0"), slug, tier:g, grade:difficulty[g], question,answer
  }))));
const normal = (value:string) => value.normalize("NFKC")
 .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu,"")
 .replace(/[أإآٱ]/gu,"ا").replace(/ى/gu,"ي")
 .replace(/[^\p{L}\p{N} ]/gu," ").replace(/\s+/gu," ").trim().toLocaleLowerCase("ar");
const csvRow = (s:string) => [...s.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(m=>m[1].replace(/""/g,'"'));
const allPackQuestions = (p:Record<string,Pack>) => Object.values(p).flatMap(pack=>grades.flatMap(g=>pack[g].map(([q])=>normal(q))));

describe("Entertainment 7 × 96 — isolated unpublished content quality", () => {
  it("has seven owner-requested distinct complete banks with 32 candidates at each score", () => {
    expect(Object.keys(entertain).sort()).toEqual(["cars","games","movies","people","riddles","series","who-am-i"]);
    expect(rows).toHaveLength(672);
    for(const [slug,pack] of Object.entries(entertain)) {
      for(const grade of grades) expect(pack[grade], slug+"/"+grade).toHaveLength(32);
      expect(ownerBoardCatalogProposal.filter(([s])=>s===slug),slug).toHaveLength(1);
    }
    expect(ownerBoardCatalogProposal).toHaveLength(27);
  });
  it("rejects normalized duplicate questions across the entire authored candidate pool", () => {
    const all = [
      ...boardSamples.map(row=>normal(row[1])),
      ...allPackQuestions(earlier),
      ...allPackQuestions(entertain),
    ];
    expect(all).toHaveLength(2112);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(rows.map(r=>r.id)).size).toBe(672);
  });
  it("rejects empty content, long revealed answers, and oversized question strings", () => {
    for(const row of rows) {
      expect(row.question.trim().length,row.id).toBeGreaterThanOrEqual(12);
      expect(row.answer.trim().length,row.id).toBeGreaterThan(0);
      expect(row.question.length,row.id).toBeLessThanOrEqual(2000);
      expect(row.answer.length,row.id).toBeLessThanOrEqual(1000);
      if(normal(row.answer).length>=9) expect(normal(row.question),row.id).not.toContain(normal(row.answer));
    }
  });
  it("distinguishes direct public-figure fact questions from three-clue Who am I prompts", () => {
    expect(peopleCandidate["200"].every(([q])=>q.startsWith("من "))).toBe(true);
    for(const row of rows.filter(r=>r.slug==="who-am-i")) {
      expect(row.question.startsWith("أنا "),row.id).toBe(true);
      expect(row.question.endsWith("فمن أنا؟"),row.id).toBe(true);
      expect((row.question.match(/؛/g)||[]).length,row.id).toBe(2);
    }
    expect(rows.filter(r=>r.slug==="who-am-i")).toHaveLength(96);
  });
  it("does not repeat identified film titles across easy story questions and hard award questions", () => {
    const movieTitles = ["200","600"] as const;
    const normalizedFilmAnswers = movieTitles.flatMap(g=>moviesCandidate[g].map(([,answer])=>
      normal(answer).replace(/ ?the artist/g,"").trim()));
    expect(new Set(normalizedFilmAnswers).size).toBe(64);
  });
  it("retains the checked historical film-award replacements and a family-friendly TV easy clue", () => {
    expect(moviesCandidate["600"][1][1]).toContain("ذا ستينغ");
    expect(moviesCandidate["600"][3][1]).toBe("المريض الإنجليزي");
    expect(moviesCandidate["600"][4][1]).toBe("عقل جميل");
    expect(moviesCandidate["600"][6][1]).toBe("القلب الشجاع");
    expect(moviesCandidate["600"][12][1]).toBe("المليونير المتشرد");
    expect(moviesCandidate["600"][17][1]).toBe("الجمال الأمريكي");
    expect(seriesCandidate["200"][27][1]).toBe("مودرن فاميلي");
  });
  it("prevents repeated celebrity answers, repeated mystery identities and double first-person wording", () => {
    const peopleAnswers = grades.flatMap(g=>peopleCandidate[g].map(([,a])=>normal(a)));
    const mysteryAnswers = grades.flatMap(g=>whoAmICandidate[g].map(([,a])=>normal(a)));
    expect(new Set(peopleAnswers).size).toBe(96);
    expect(new Set(mysteryAnswers).size).toBe(96);
    for(const g of grades) for(const [q] of whoAmICandidate[g]) {
      expect(q).toMatch(/^أنا /);
      expect(q).not.toMatch(/^أنا أنا /);
    }
  });
  it("keeps WhoAmI reveal identities distinct from selectable People answers", () => {
    const direct = new Set(grades.flatMap(g=>peopleCandidate[g].map(([,answer])=>normal(answer))));
    const clues = grades.flatMap(g=>whoAmICandidate[g].map(([,answer])=>normal(answer)));
    expect(clues).toHaveLength(96);
    expect(new Set(clues).size).toBe(96);
    expect(clues.filter(answer=>direct.has(answer))).toEqual([]);
  });
  it("limits repetitive medium riddles to two numeric-sequence prompts", () => {
    const medium = riddlesCandidate["400"];
    expect(medium.filter(([question])=>question.includes("العدد التالي في المتتالية"))).toHaveLength(2);
    expect(medium[12][1]).toBe("ثمرة واحدة");
    expect(medium[14][1]).toBe("الصندوق أ");
    expect(medium[15][1]).toBe("وزنتان");
    expect(medium[21][1]).toBe("سبع مرات");
  });
  it("keeps Games600 from regressing into a 32-question release-year memorization round", () => {
    const hard = gamesCandidate["600"];
    expect(hard).toHaveLength(32);
    expect(hard.filter(([q])=>q.startsWith("في أي سنة صدرت لعبة"))).toHaveLength(17);
    expect(hard[17][1]).toContain("البيسبول");
    expect(hard[18][1]).toContain("GLaDOS");
    expect(hard[31][1]).toContain("Illithid tadpole");
  });
  it("guards against specific corrected editorial errors without certifying every fact", () => {
    expect(seriesCandidate["200"][9][0]).not.toContain("جرّاح");
    expect(gamesCandidate["400"][21][1]).toBe("ببجي كوربوريشن (PUBG Corporation)");
    expect(carsCandidate["600"][19][0]).toContain("نوع الإطار");
    expect(peopleCandidate["400"][21][1]).toBe("رجاء عالم");
  });
  it("matches all 672 questions exactly against the pending independent item review ledger", () => {
    const csv=readFileSync(new URL("../../../content-review/2026-10-19/Board_Entertainment_7x96_Review.csv",import.meta.url),"utf8");
    const lines=csv.trimEnd().split(/\r?\n/);
    expect(lines).toHaveLength(673);
    const headings=csvRow(lines[0]);
    expect(headings).toHaveLength(16);
    expect(headings).toContain("source_reference_for_reviewer");
    for(let i=0;i<rows.length;i++){
      const cols=csvRow(lines[i+1]), r=rows[i];
      expect(cols,r.id).toHaveLength(16);
      expect(cols.slice(0,6),r.id).toEqual([r.id,r.slug,r.tier,r.grade,r.question,r.answer]);
      expect(cols.slice(8,12),r.id).toEqual([
        "PENDING_INDEPENDENT_FACTCHECK","PENDING_INDEPENDENT_ITEM_REVIEW","NOT_RUN","NOT_RUN"
      ]);
      expect(cols[12],r.id).toBe("");
      expect(cols[13],r.id).toBe("");
      expect(cols[14],r.id).toBe("NO_MEDIA_ASSETS_SHIPPED");
    }
  });
  it("does not modify or enable shared seeded categories or the baseline 576 Board playable items", () => {
    const source=sourceBanks()["category-board"];
    expect(source).toHaveLength(576);
    expect(source.some(row=>Object.keys(entertain).includes(row.categoryId))).toBe(false);
    const seed=readFileSync(new URL("../../../prisma/seed.ts",import.meta.url),"utf8");
    const core=readFileSync(new URL("../../../prisma/core-content.ts",import.meta.url),"utf8");
    for(const slug of Object.keys(entertain)) {
      expect(seed).not.toContain(slug+"-candidate");
      expect(core).not.toContain(slug+"-candidate");
    }
    for(const [slug] of ownerBoardCatalogProposal) expect(slug).not.toBe("anime");
  });
});
