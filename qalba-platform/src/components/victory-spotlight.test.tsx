import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VictorySpotlight } from "./victory-spotlight";

describe("TV finale presentation", () => {
  it("uses the real winner name supplied by the live view", () => {
    const html = renderToStaticMarkup(<VictorySpotlight names={["فريق الموج"]} />);
    expect(html).toContain("الفائز: فريق الموج");
    expect(html).not.toContain("فريق البرق");
    expect(html).toContain("<h1>");
  });
  it("handles a draw and a different heading level", () => {
    const html = renderToStaticMarkup(<VictorySpotlight names={["فريق البرق", "فريق الموج"]} headingLevel="h2" />);
    expect(html).toContain("<h2>تعادل!</h2>");
    expect(html).toContain("فريق البرق و فريق الموج");
  });
  it("does not invent a winner when the view has none", () => {
    expect(renderToStaticMarkup(<VictorySpotlight names={[]} />)).toContain("انتهت المباراة");
  });
});
