import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bluffSamples } from "../prisma/bluff-questions";

const directory = new URL("../content-review/2026-10-15/", import.meta.url);

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value); value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(value); value = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else value += c;
  }
  if (quoted) throw new Error("Unterminated CSV quoted field");
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function load(name: string, questionColumn: string, idColumn: string) {
  const rows = parseCsv(readFileSync(new URL(name, directory), "utf8"));
  const header = rows.shift()!;
  const qIndex = header.indexOf(questionColumn);
  const idIndex = header.indexOf(idColumn);
  expect(qIndex).toBeGreaterThanOrEqual(0);
  expect(idIndex).toBeGreaterThanOrEqual(0);
  return rows.map((row) => {
    expect(row).toHaveLength(header.length);
    return { bank: name, id: row[idIndex], question: row[qIndex] };
  });
}

function normalized(question: string): string {
  return question
    .normalize("NFKC")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLocaleLowerCase("ar");
}

describe("review-only staged content cross-bank duplicate guard", () => {
  const board = load("Board_1296_Remediated.csv", "السؤال أو التحدي", "الرقم داخل اللعبة");
  const lightning = load("Lightning_600_Remediated.csv", "question", "id");
  const letters = load("Letter_224_V4_Aliases_Corrected_Review_Pending.csv", "question", "id");
  const stagedBluff = load("Bluff_13_Remediated_Sourced_Review_Pending.csv", "question", "id");
  const originalBluff = bluffSamples.map((item) => ({ bank: "original-bluff", id: item.id, question: item.question }));

  it("preserves the requested staged bank sizes", () => {
    expect(board).toHaveLength(1296);
    expect(lightning).toHaveLength(600);
    expect(letters).toHaveLength(224);
    expect(stagedBluff).toHaveLength(13);
    expect(originalBluff).toHaveLength(156);
  });

  it("does not repeat normalized questions across three core review banks and both Bluff banks", () => {
    const seen = new Map<string, string>();
    for (const item of [...board, ...lightning, ...letters, ...stagedBluff, ...originalBluff]) {
      const key = normalized(item.question);
      expect(key.length).toBeGreaterThan(0);
      const origin = seen.get(key);
      expect(origin, `Repeated question: ${item.bank} / ${item.id} vs ${origin ?? "none"}: ${item.question}`).toBeUndefined();
      seen.set(key, `${item.bank}/${item.id}`);
    }
  });

  it("blocks the known catalyst semantic overlap with the Letter review bank", () => {
    const lightningItem = lightning.find((item) => item.id === "lightning-v600-science-36");
    const letterItem = letters.find((item) => item.id === "letter-mh-047");
    expect(lightningItem?.question).toBe("في معادلة أرينيوس لسرعة التفاعل الكيميائي ما اسم المقدار الذي يرمز له بـ Ea؟");
    expect(letterItem?.question).toBe("ما اسم المادة التي تسرّع التفاعل الكيميائي من دون أن تُستهلك فيه؟");
  });

  it("replaces the known verbatim actor-question duplication against original Bluff", () => {
    const replacement = lightning.find((item) => item.id === "lightning-v600-screen-03");
    expect(replacement?.question).toContain("مزامنة الصوت والصورة");
    expect(originalBluff.some((item) => normalized(item.question) === normalized(replacement!.question))).toBe(false);
  });

  it("replaces the known verbatim electrical-insulator duplication in the Lightning review bank", () => {
    const replacement = lightning.find((item) => item.id === "lightning-v600-science-31");
    expect(replacement?.question).toBe("ما اسم خاصية السائل التي تعبّر عن مقاومته للانسياب؟");
    expect(board.some((item) => normalized(item.question) === normalized(replacement!.question))).toBe(false);
  });
});
