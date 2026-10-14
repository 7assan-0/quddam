import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "@/app/page";
import { BrandMark } from "./brand";
import { featuredGames } from "@/lib/brand/games";

const sheet = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Quddam color discipline", () => {
  it("keeps the Sun / Night / Spark chevron brand instead of a bolt logo", () => {
    const mark = renderToStaticMarkup(<BrandMark />);
    const styles = sheet("src/styles/game-show.css");
    expect(mark).toContain("quddam-mark-tile");
    expect(mark).toContain("quddam-mark-chevron");
    expect(mark).toContain("quddam-mark-spark");
    expect(mark).not.toContain("game-emblem--lightning");
    expect(styles).toContain(".quddam-mark-tile { fill:var(--color-accent-gold)");
    expect(styles).toContain(".quddam-mark-chevron { fill:var(--color-primary)");
    expect(styles).toContain(".quddam-mark-spark { fill:var(--color-secondary)");
  });
  it("cycles only brand-color badge and icon chips across all ten cards", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html.match(/<article class="quddam-home-game"/g)).toHaveLength(10);
    expect(html.match(/class="game-icon-chip"/g)).toHaveLength(10);
    featuredGames.forEach((game, index) => {
      expect(html).toContain(`data-game="${game.slug}" data-color="${index % 4}"`);
    });
    const styles = sheet("src/styles/game-show.css");
    expect(styles).toContain("background:var(--color-primary-surface); color:var(--color-bg);");
    expect(styles).toContain("--card-chip:var(--color-secondary)");
    expect(styles).toContain("--card-chip:var(--color-accent-turquoise)");
    expect(styles).toContain("--card-chip:var(--color-bg)");
  });
  it("uses Cream and excludes discontinued pastels and team colors on marketing previews", () => {
    const tokens = sheet("src/styles/tokens.css");
    const styles = sheet("src/styles/game-show.css");
    const marketing = sheet("src/styles/quddam.css");
    expect(tokens).toContain("--color-bg: #FFF6DC;");
    expect(tokens).toContain("--color-text-inverse: #FFF6DC;");
    for (const color of ["#FF956B", "#C4ACFF", "#78D9FF", "#89E8A4"]) {
      expect(tokens + styles).not.toContain(color);
    }
    expect(styles).not.toMatch(/--color-game-(coral|lilac|sky|mint)/);
    expect(marketing.split("\n").filter(line => line.includes(".preview-team")).join("\n")).not.toMatch(/--team-[abcd]/);
  });
});
