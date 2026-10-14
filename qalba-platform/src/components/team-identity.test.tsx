import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "@/app/page";
import { TEAM_COLORS, teamColor } from "@/lib/design/team-colors";
import { TeamMarker } from "./team-marker";
import { VictorySpotlight } from "./victory-spotlight";

const css = readFileSync(join(process.cwd(), "src/styles/game-show.css"), "utf8");
describe("Quddam team identity and hero comparison", () => {
  it("keeps distinct A bolt, B wave, C square in the exact approved colors", () => {
    expect(TEAM_COLORS).toEqual(["#FF7A45", "#4DB8FF", "#E58FC0"]);
    const markers = [0, 1, 2].map(position => renderToStaticMarkup(<TeamMarker position={position} color="#FFD21F" />));
    expect(markers[0]).toContain('aria-label="رمز البرق"');
    expect(markers[1]).toContain('aria-label="رمز الموج"');
    expect(markers[2]).toContain('aria-label="رمز المربع"');
    expect(markers[2]).toContain('<rect x="3" y="3" width="14" height="14" rx="1"');
    expect(markers[2]).not.toContain("<circle");
    markers.forEach((markup, position) => expect(markup.toLowerCase()).toContain(`color:${teamColor(position).toLowerCase()}`));
    expect(new Set(markers.map(markup => markup.match(/<path[^>]+>|<rect[^>]+>/)?.[0])).size).toBe(3);
    expect(TEAM_COLORS).not.toContain("#FFD21F");
    expect(TEAM_COLORS).not.toContain("#19E3D1");
  });
  it("renders Team C as the same pink square in TV and phone wrappers", () => {
    for (const surface of ["display-team", "preview-phone-option"]) {
      const html = renderToStaticMarkup(<div className={surface}><TeamMarker position={2} /></div>);
      expect(html).toContain('aria-label="رمز المربع"');
      expect(html).toContain('<rect x="3" y="3" width="14" height="14" rx="1"');
      expect(html.toLowerCase()).toContain("color:#e58fc0");
      expect(html).not.toContain("<circle");
    }
  });
  it("renders those same symbols on the winners strip", () => {
    const html = renderToStaticMarkup(<VictorySpotlight names={["فريق البرق","فريق الموج"]} positions={[0,1]} />);
    expect(html).toContain('aria-label="رمز البرق"');
    expect(html).toContain('aria-label="رمز الموج"');
    expect(html).toContain('class="victory-skyline"');
  });
  it("keeps Night/Sun variants restricted to the landing hero and skyline separated", () => {
    const html = renderToStaticMarkup(Home());
    expect(html).toMatch(/class="quddam-sun-hero" data-hero-theme="(?:night|sun)"/);
    expect(html).toContain("preview-device-pair");
    expect(html).toContain("preview-phone");
    expect(css).toContain('.quddam-sun-hero[data-hero-theme="sun"]');
    expect(css).toContain('.quddam-sun-hero[data-hero-theme="night"]');
    expect(css).toContain("victory-skyline");
    expect(css).toContain("opacity:.2");
    expect(css).toContain("background:var(--vote-team); color:var(--color-primary)");
    for (const accent of ["#FF956B","#C4ACFF","#78D9FF","#89E8A4"]) expect(css).not.toContain(accent);
  });
});
