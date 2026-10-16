import { describe, expect, it } from "vitest";
import { authReturnPath } from "./return-path";
describe("narrow invitation authentication continuation", () => {
  it("retains only a canonical local Shillatak bearer-page path", () => {
    expect(authReturnPath(`/shillatak/join/${"A".repeat(64)}`)).toBe(`/shillatak/join/${"a".repeat(64)}`);
  });
  it.each([undefined, null, {}, "/games", "/admin", "https://evil.invalid", "//evil.invalid",
    "javascript:alert(1)", `/shillatak/join/${"a".repeat(64)}?next=https://evil.invalid`,
    `/shillatak/join/${"a".repeat(64)}#secret`, `/shillatak/join/${"a".repeat(64)}\n`,
    `/shillatak/join/${"a".repeat(63)}`, "/shillatak/join/%2f%2fevil.invalid"])(
    "falls back to the existing destination for unsupported input %s", value => {
      expect(authReturnPath(value)).toBe("/games");
    });
});
