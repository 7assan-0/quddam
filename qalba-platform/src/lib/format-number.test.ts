import { describe, expect, it } from "vitest";
import { formatNumber } from "./format-number";

describe("shared UI number formatting", () => {
  it("uses Latin digits for numbers including zero and grouped values", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(600)).toBe("600");
    expect(formatNumber(2026)).toBe("2,026");
  });
  it("normalizes Eastern Arabic and Persian digit labels", () => {
    expect(formatNumber("٦٠٠/٤٠٠")).toBe("600/400");
    expect(formatNumber("۳–۱۲")).toBe("3–12");
    expect(formatNumber("١٠٬٠٠٠")).toBe("10,000");
  });
});
