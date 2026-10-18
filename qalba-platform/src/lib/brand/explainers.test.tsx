import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { InfoTip } from "@/components/info-tip";
import { categoryExplanation, gameExplanation } from "./explainers";

describe("Contextual explanations are presentation-only and accessible", () => {
  it("has short grounded copy for common categories and a safe generic fallback", () => {
    expect(categoryExplanation("تاريخ").description).toContain("التاريخية");
    expect(categoryExplanation("رياضة").example).toContain("بطولات");
    expect(categoryExplanation("فئة جديدة").description).toContain("فئة جديدة");
  });
  it("explains the actual 6x6 board and three-game night without changing any source", () => {
    expect(gameExplanation("category-board", "fallback", "فريقان").description).toContain("36");
    expect(gameExplanation("night-of-quddam", "fallback", "فريقان").description).toContain("ثلاث ألعاب");
    expect(gameExplanation("other", "fallback", "فريقان").description).toBe("fallback");
  });
  it("renders a keyboard-focusable explanation control and a labelled closable dialog", () => {
    const html = renderToStaticMarkup(createElement(InfoTip, { title: "رياضة", ...categoryExplanation("رياضة") }));
    expect(html).toContain('aria-label="شرح رياضة"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("<dialog");
    expect(html).toContain('aria-label="إغلاق الشرح"');
  });
});
