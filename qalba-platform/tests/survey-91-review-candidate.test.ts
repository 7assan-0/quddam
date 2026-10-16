import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { surveySamples } from "../prisma/survey-questions";
import { matches, normalizeArabic, validateAnswers } from "../src/lib/games/survey-battle/module";

const reviewDir = new URL("../content-review/2026-10-16/", import.meta.url);
const oldDir = new URL("../content-review/2026-10-15/", import.meta.url);

function parseCsv(source: string): Record<string, string>[] {
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
  if (quoted) throw Error("Unclosed CSV quotation");
  if (row.length || cell) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  if (!head) throw Error("Missing CSV header");
  return rows.map((values) => {
    if (values.length !== head.length) throw Error("Incorrect CSV column count");
    return Object.fromEntries(head.map((key, index) => [key, values[index]]));
  });
}
const read = (name: string, historical = false) =>
  parseCsv(readFileSync(new URL(name, historical ? oldDir : reviewDir), "utf8"));
type Answer = { answer: string; alternativeAnswers: string[]; points: number; position: number };
const candidate = read("Survey_91_V1_Combined_Review_Only.csv");
const supplement = read("Survey_26_V2_Editorial_Candidate.csv");
const historical = read("Survey_26_Remediated.csv", true);
const ledger = read("Survey_91_Item_Editorial_Gate.csv");
const norm = (value: string) => normalizeArabic(value);
const answers = (row: Record<string, string>): Answer[] => JSON.parse(row.answers_json) as Answer[];
const byId = (id: string) => {
  const row = candidate.find((item) => item.id === id);
  if (!row) throw Error("Missing candidate ID: " + id);
  return row;
};
function balance(points: number[]): number[] {
  const total = points.reduce((sum, n) => sum + n, 0);
  const fractions = points.map((n) => n * 100 / total);
  const rounded = fractions.map(Math.floor);
  const extra = 100 - rounded.reduce((sum, n) => sum + n, 0);
  const priorities = fractions.map((n, i) => ({ index: i, remainder: n - rounded[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < extra; i++) rounded[priorities[i].index]++;
  return rounded;
}
const rewrittenSupplements = [
  "daily-02", "saudi-02", "family-01", "food-02", "travel-01", "travel-02",
  "school-01", "tech-01", "games-02", "cars-01", "work-01", "light-01", "light-02"
].map((key) => "survey-supplement-" + key);

describe("Survey Show 91-round candidate (review-only, NOT imported or human approved)", () => {
  it("preserves the 65 original IDs and 26 supplemental IDs, seven rounds in every category", () => {
    expect(surveySamples).toHaveLength(65);
    expect(candidate).toHaveLength(91);
    expect(supplement).toHaveLength(26);
    expect(ledger).toHaveLength(91);
    expect(new Set(candidate.map((row) => row.id)).size).toBe(91);
    expect(candidate.slice(0, 65).map((row) => row.id))
      .toEqual(surveySamples.map((_, index) => "survey-seed-" + (index + 1)));
    expect(candidate.slice(65).map((row) => row.id)).toEqual(supplement.map((row) => row.id));
    const categories = new Map<string, number>();
    for (const item of candidate) categories.set(item.category, (categories.get(item.category) ?? 0) + 1);
    expect(categories.size).toBe(13);
    expect([...categories.values()].every((n) => n === 7)).toBe(true);
  });

  it("enforces 546 distinct answer slots in 91 authored 100-point rounds and noncolliding aliases", () => {
    let slots = 0, aliases = 0;
    for (const item of candidate) {
      expect(item.sourceType).toBe("CURATED");
      expect(item.score_policy).toBe("SIX_ANSWERS_100_AUTHORED_POINTS");
      expect(item.import_state).toBe("REVIEW_ONLY_NOT_IMPORTED");
      expect(item.qa_status).toBe("REVIEW_REQUIRED_NOT_APPROVED");
      const a = answers(item);
      expect(a).toHaveLength(6);
      expect(a.reduce((sum, answer) => sum + answer.points, 0)).toBe(100);
      expect(a.map((answer) => answer.position)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(validateAnswers(a)).toBe(true);
      const seen = new Set<string>();
      for (const answer of a) {
        slots++;
        aliases += answer.alternativeAnswers.length;
        for (const phrase of [answer.answer, ...answer.alternativeAnswers]) {
          const key = norm(phrase);
          expect(key).not.toBe("");
          expect(seen.has(key), "Ambiguous normalized answer in " + item.id + ": " + phrase).toBe(false);
          seen.add(key);
        }
      }
    }
    expect(slots).toBe(546);
    expect(aliases).toBe(117);
    expect(new Set(candidate.map((row) => norm(row.question))).size).toBe(91);
  });

  it("balances historical original 93/99/105 totals without editing the runtime seed", () => {
    for (let i = 0; i < 65; i++) {
      const source = surveySamples[i];
      const item = candidate[i];
      const before = source.answers.map((a) => a.points);
      expect(before.reduce((sum, n) => sum + n, 0)).toBe([93, 99, 105][i % 3]);
      expect(answers(item).map((a) => a.points)).toEqual(balance(before));
      expect(item.origin).toBe("ORIGINAL_SOURCE");
    }
  });

  it("changes only the two explicitly selected original prompt/answer sets", () => {
    const changed = new Set(["survey-seed-23", "survey-seed-49"]);
    for (let i = 0; i < 65; i++) {
      const item = candidate[i];
      if (!changed.has(item.id)) {
        expect(item.question).toBe(surveySamples[i].question);
        expect(answers(item).map((answer) => answer.answer))
          .toEqual(surveySamples[i].answers.map((answer) => answer.answer));
      } else expect(item.question).not.toBe(surveySamples[i].question);
    }
    expect(byId("survey-seed-23").question).toContain("موظف استقبال الفندق");
    expect(byId("survey-seed-49").question).toContain("يزعجك");
  });

  it("keeps the historical 26-pack unchanged and the V2/combined supplemental candidates identical", () => {
    expect(historical.map((item) => item.id)).toEqual(supplement.map((item) => item.id));
    expect(rewrittenSupplements).toHaveLength(13);
    const changedPrompts = supplement.filter((item, index) => item.question !== historical[index].question).map((item) => item.id);
    expect(changedPrompts).toHaveLength(12); // school-01 keeps its question but clarifies two answer slots
    const changed = supplement.filter((item, index) =>
      item.question !== historical[index].question ||
      JSON.stringify(answers(item)) !== JSON.stringify(answers(historical[index]))
    ).map((item) => item.id);
    expect(changed.sort()).toEqual([...rewrittenSupplements].sort());
    expect(answers(supplement.find((item) => item.id === "survey-supplement-school-01")!)
      .map((item) => item.answer)).toContain("لابتوب");
    for (const s of supplement) {
      const c = byId(s.id);
      expect(c.question).toBe(s.question);
      expect(answers(c)).toEqual(answers(s));
      expect(c.origin).toBe("STAGED_SUPPLEMENT");
      expect(s.sourceType).toBe("CURATED");
      expect(s.source_disclosure).toContain("ليست بيانات استطلاع");
      expect(s.qa_status).toContain("HUMAN_PLAYTEST_PENDING");
    }
  });

  it("guards against known duplicate themes and flawed answer sets", () => {
    expect(byId("survey-supplement-food-02").question).toContain("يطلع غلط في الكيكة");
    expect(byId("survey-supplement-travel-01").question).toContain("بعد تسليم الشنطة");
    expect(byId("survey-supplement-light-02").question).toContain("في عزيمة");
    expect(byId("survey-supplement-daily-02").question).toContain("تتأكد منه");
    const tyre = answers(byId("survey-supplement-cars-01")).map((answer) => answer.answer);
    expect(tyre).toEqual(["ضغط الهواء", "عمق النقشة", "وجود تشققات", "انتفاخ الجنب", "وجود مسمار", "تاريخ التصنيع"]);
    expect(tyre).not.toContain("الاحتياطي");
    const tech = answers(byId("survey-supplement-tech-01")).map((answer) => answer.answer);
    expect(tech).not.toContain("بطء");
    expect(tech).not.toContain("تطبيق لا يستجيب");
  });

  it("checks real matcher normalization for selected safe candidate aliases; host remains final judge", () => {
    for (const [id, spoken, expected] of [
      ["survey-seed-7", "كاش", "نقود"],
      ["survey-seed-23", "كلمة سر النت", "كلمة مرور الواي فاي"],
      ["survey-supplement-food-02", "ما ترتفع", "ما تنتفخ"],
      ["survey-supplement-cars-01", "ضغط الكفر", "ضغط الهواء"]
    ]) {
      const row = byId(id);
      const found = matches({
        id, question: row.question, sourceType: "CURATED",
        answers: answers(row).map((item, i) => ({ ...item, id: id + "-" + i }))
      }, spoken);
      expect(found.map((answer) => answer.answer)).toEqual([expected]);
    }
  });

  it("does not mislabel automated checks as editorial approval or human playtesting", () => {
    expect(ledger.map((row) => row.id)).toEqual(candidate.map((row) => row.id));
    for (const item of ledger) {
      expect(item.candidate_points).toBe("100");
      expect(item.answer_slots).toBe("6");
      expect(item.editorial_status).toBe("PENDING_INDEPENDENT_ITEM_REVIEW");
      expect(item.alias_status).toBe("PENDING_HUMAN_SPOKEN_GUESS_REVIEW");
      expect(item.playtest_status).toBe("NOT_RUN");
      expect(item.reviewer).toBe("");
      expect(item.review_date).toBe("");
      expect(Number(item.candidate_aliases)).toBe(answers(byId(item.id)).reduce((n, a) => n + a.alternativeAnswers.length, 0));
    }
  });

  it("preserves player-facing authored-not-real-poll disclosure in all three live views", () => {
    const root = new URL("../src/components/", import.meta.url);
    const view = readFileSync(new URL("survey-display.tsx", root), "utf8");
    const host = readFileSync(new URL("survey-host.tsx", root), "utf8");
    const setup = readFileSync(new URL("survey-setup.tsx", root), "utf8");
    for (const file of [view, host, setup]) expect(file).toContain("ليست نتائج استطلاع حقيقي");
  });
});
