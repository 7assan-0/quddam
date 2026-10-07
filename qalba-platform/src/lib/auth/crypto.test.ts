import { describe, expect, it } from "vitest";
import { hashPassword, newToken, tokenHash, verifyPassword } from "./crypto";

describe("account secrets", () => {
  it("hashes passwords with different salts and verifies only the right secret", async () => {
    const first = await hashPassword("a long password 123");
    const second = await hashPassword("a long password 123");
    expect(first).not.toBe(second);
    expect(await verifyPassword("a long password 123", first)).toBe(true);
    expect(await verifyPassword("wrong password", first)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("uses opaque high entropy tokens and only exposes a digest to storage", () => {
    const first = newToken();
    const second = newToken();
    expect(first).not.toBe(second);
    expect(tokenHash(first)).toHaveLength(64);
    expect(tokenHash(first)).toBe(tokenHash(first));
    expect(tokenHash(first)).not.toBe(first);
  });
});
