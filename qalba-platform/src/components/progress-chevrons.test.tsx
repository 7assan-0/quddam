import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressChevrons } from "./progress-chevrons";
import { TimerRing } from "./timer-ring";

describe("Phase 2 TV presentation components", () => {
  it("uses Arabic-Indic digits and fills the current and previous chevrons", () => {
    const html = renderToStaticMarkup(<ProgressChevrons current={3} total={5} />);
    expect(html).toContain('aria-label="الجولة ٣ من ٥"');
    expect(html.match(/class="progress-chevron is-filled"/g)).toHaveLength(3);
    expect(html.match(/class="progress-chevron"/g)).toHaveLength(2);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(5);
  });
  it("clamps invalid round values and renders nothing when the total is zero", () => {
    const html = renderToStaticMarkup(<ProgressChevrons current={20} total={2} />);
    expect(html).toContain('aria-label="الجولة ٢ من ٢"');
    expect(renderToStaticMarkup(<ProgressChevrons current={1} total={0} />)).toBe("");
  });
  it("shows real remaining seconds and omits a ring without a known duration", () => {
    const html = renderToStaticMarkup(<TimerRing remainingMs={5000} durationMs={30000} />);
    expect(html).toContain('aria-label="الوقت المتبقي ٥ ثانية"');
    expect(html).toContain("timer-ring--urgent");
    expect(renderToStaticMarkup(<TimerRing remainingMs={5000} durationMs={0} />)).toBe("");
  });
});
