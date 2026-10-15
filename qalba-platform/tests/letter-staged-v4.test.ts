import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dir = new URL("../content-review/2026-10-15/", import.meta.url);

function parseRow(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      values.push(value);
      value = "";
    } else value += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  values.push(value);
  return values;
}

function readBank(filename: string): Array<Record<string, string>> {
  const lines = readFileSync(new URL(filename, dir), "utf8").trimEnd().split(/\r?\n/);
  const header = parseRow(lines.shift()!);
  return lines.map((line) => {
    const cells = parseRow(line);
    expect(cells).toHaveLength(header.length);
    return Object.fromEntries(header.map((key, index) => [key, cells[index]]));
  });
}

const invalidAliases: Record<string, string> = {
  "letter-mh-022": "توغريك",
  "letter-mh-031": "ثنائي أكسيد السيليكون",
  "letter-mh-062": "دينار مقدونيا",
  "letter-mh-099": "شهاب الدين يحيى السهروردي",
  "letter-mh-132": "ظهير الدين محمد بابر",
  "letter-mh-153": "فادوز",
  "letter-mh-183": "لوكس متر",
  "letter-mh-186": "مانات",
  "letter-mh-202": "هريفنيا أوكرانية",
};

describe("review-only letter V4 alias corrections", () => {
  const v3 = readBank("Letter_224_V3_Canonical_Unmodified.csv");
  const v4 = readBank("Letter_224_V4_Aliases_Corrected_Review_Pending.csv");

  it("retains 224 distinct questions with eight per Arabic letter (six medium, two hard)", () => {
    expect(v4).toHaveLength(224);
    expect(new Set(v4.map((q) => q.id)).size).toBe(224);
    const letters = [..."ابتثجحخدذرزسشصضطظعغفقكلمنهوي"];
    expect(new Set(v4.map((q) => q.letter))).toEqual(new Set(letters));
    for (const letter of letters) {
      const questions = v4.filter((q) => q.letter === letter);
      expect(questions).toHaveLength(8);
      expect(questions.filter((q) => q.difficulty === "MEDIUM")).toHaveLength(6);
      expect(questions.filter((q) => q.difficulty === "HARD")).toHaveLength(2);
    }
  });

  it("removes all nine documented false aliases without silently changing the answers or other aliases", () => {
    expect(v3.map((q) => q.id)).toEqual(v4.map((q) => q.id));
    const before = new Map(v3.map((q) => [q.id, q]));
    expect(Object.keys(invalidAliases)).toHaveLength(9);
    for (const q of v4) {
      const prior = before.get(q.id)!;
      expect(q.answer).toBe(prior.answer);
      expect(q.question).toBe(prior.question);
      const alternatives = JSON.parse(q.alternativeAnswers) as string[];
      expect(Array.isArray(alternatives)).toBe(true);
      if (q.id in invalidAliases) {
        expect(JSON.parse(prior.alternativeAnswers)).toEqual([invalidAliases[q.id]]);
        expect(alternatives).toEqual([]);
      } else {
        expect(q.alternativeAnswers).toBe(prior.alternativeAnswers);
      }
    }
  });
});
