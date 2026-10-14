import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEAM_COLORS } from "@/lib/design/team-colors";

const root = process.cwd();
const tokens = readFileSync(join(root, "src/styles/tokens.css"), "utf8");
const css = ["src/app/globals.css", "src/styles/components.css"].map((file) => readFileSync(join(root, file), "utf8"));
const hex = (name: string) => {
  const match = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`Missing ${name}`);
  return match[1];
};
const luminance = (color: string) => {
  const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
};
const contrast = (a: string, b: string) => {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + .05) / (low + .05);
};

describe("Qalba visual token contract", () => {
  it("keeps normal text contrast above WCAG AA on its semantic surfaces", () => {
    const pairs = [
      ["neutral-900", "color-secondary"], ["neutral-900", "color-danger"],
      ["neutral-900", "color-success"], ["neutral-900", "color-accent-turquoise"],
      ["color-text-inverse", "color-primary-surface"], ["neutral-300", "color-primary-surface"],
      ["neutral-900", "color-accent-gold"], ["color-spark-text", "color-primary-surface"],
      ["color-danger-label", "color-primary-surface"],
    ];
    for (const [foreground, background] of pairs) expect(contrast(hex(foreground), hex(background)), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
  });

  it("centralizes palette values and does not advertise inactive themes", () => {
    for (const sheet of css) {
      expect(sheet).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(sheet).not.toMatch(/--theme-|data-theme/);
    }
    expect(tokens).not.toMatch(/data-theme/);
    expect(css[0]).not.toMatch(/\.board-cell\.used::after/);
  });

  it("ships three distinct team colors and an Arabic font", () => {
    const teams = ["a", "b", "c"].map((team) => hex(`team-${team}`));
    expect(new Set(teams).size).toBe(3);
    expect(teams).toEqual(TEAM_COLORS);
    for (const team of teams) expect(contrast(team, hex("color-primary-surface"))).toBeGreaterThanOrEqual(3);
    expect(contrast(hex("neutral-400"), hex("color-primary-surface"))).toBeGreaterThanOrEqual(3);
    expect(readFileSync(join(root, "public/fonts/lalezar/Lalezar-Regular.ttf")).byteLength).toBeGreaterThan(100_000);
    for (const style of ["Regular", "Bold"]) expect(readFileSync(join(root, `public/fonts/NotoSansArabic-${style}.ttf`)).byteLength).toBeGreaterThan(100_000);
    expect(tokens).toContain("font-family: \"Qalba Arabic\"");
  });
});
