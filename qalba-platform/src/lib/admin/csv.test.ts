import { describe, expect, it } from "vitest";
import { columns, parseCsv, toCsv, validateImport } from "./csv";

const games = new Map([["category-board", "game-1"]]);
const categories = new Map([["general", "cat-1"]]);
const row = ["category-board", "general", "ما الشكل الذي له ستة أضلاع؟", "سداسي", "", "", "EASY", "200", "TEXT", "", "محتوى أصلي", "DRAFT", "ar", "", "", ""];

describe("CSV question import", () => {
  it("round-trips UTF-8 quoted commas, newlines and escaped quotation marks", () => {
    const encoded = toCsv([[...columns], [...row.slice(0, 2), 'سؤال، "جديد"\nفي السطر الثاني', ...row.slice(3)]]);
    expect(parseCsv(encoded)[1][2]).toBe('سؤال، "جديد"\nفي السطر الثاني');
  });
  it("validates every row and rejects duplicate questions before a write", () => {
    const review = validateImport(toCsv([[...columns], row, row]), games, categories);
    expect(review.parsed).toHaveLength(1);
    expect(review.errors).toEqual([{ row: 3, message: "سؤال مكرر في الملف" }]);
  });
  it("rejects missing columns and malformed quotes", () => {
    expect(() => validateImport("question,answer\nX,Y", games, categories)).toThrow(/أعمدة CSV/);
    expect(() => parseCsv('"unclosed')).toThrow(/اقتباس/);
  });
  it("neutralizes spreadsheet formula cells on export", () => {
    expect(toCsv([["=SUM(1,2)", "@command"]])).toContain('"\'=SUM(1,2)"');
  });
});
