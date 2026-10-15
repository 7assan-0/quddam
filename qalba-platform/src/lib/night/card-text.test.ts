import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CARD_FONT_HASHES, cardTextRuns, localCardName } from "./card-text";

describe("local-only card glyph projection", () => {
  it("keeps Arabic words in logical order for explicit RTL layout", () => {
    expect(cardTextRuns("بطل الليلة")).toEqual(["بطل", "الليلة"]);
    expect(cardTextRuns("فريق السهرة الأول")).toEqual(["فريق", "السهرة", "الأول"]);
  });
  it("preserves contiguous Latin words, numbers and Unicode notation in LTR order", () => {
    expect(cardTextRuns("فريق Team 23 Premier الأول")).toEqual(["فريق", "Team 23 Premier", "الأول"]);
    expect(cardTextRuns("[U+1F981] و [U+1F42F]")).toEqual(["[U+1F981]", "و", "[U+1F42F]"]);
  });
  it("binds the glyph allowlist to the actual local font bytes", async () => {
    for (const [file, expected] of Object.entries(CARD_FONT_HASHES)) {
      const font = await readFile(file);
      expect(createHash("sha256").update(font).digest("hex")).toBe(expected);
    }
  });
  it("preserves supported Arabic, Latin, numbers and punctuation", () => {
    const name = "فريق النور - Team 23 (أبطال)";
    expect(localCardName(name)).toBe(name);
  });
  it("keeps different unsupported names and literal notation distinct", () => {
    expect(localCardName("🦁")).toBe("[U+1F981]");
    expect(localCardName("🐯")).toBe("[U+1F42F]");
    expect(localCardName("[U+1F981]")).toBe("[[U+1F981]]");
  });
  it("substitutes unsupported complete graphemes without changing the supplied name", () => {
    const name = "فريق 🎉 中文";
    expect(localCardName(name)).toBe("فريق [U+1F389] [U+4E2D][U+6587]");
    expect(name).toBe("فريق 🎉 中文");
  });
});
