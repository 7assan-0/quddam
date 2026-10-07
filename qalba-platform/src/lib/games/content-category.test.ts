import { expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { lockActiveCategories } from "./content-category";
const tx = (lookup: ReturnType<typeof vi.fn>) => ({ $queryRaw: lookup }) as unknown as Prisma.TransactionClient;
it("empty candidate categories do not query or invent eligibility", async () => { const lookup = vi.fn(); expect(await lockActiveCategories(tx(lookup), [])).toEqual([]); expect(lookup).not.toHaveBeenCalled(); });
it("returns only active authoritative rows, never missing or inactive candidates", async () => {
  const lookup = vi.fn().mockResolvedValue([{ id: "active", active: true }, { id: "disabled", active: false }]);
  expect(await lockActiveCategories(tx(lookup), ["active", "disabled", "missing"])).toEqual(["active"]);
});
it("locks once in deterministic deduplicated order with bound identifiers", async () => {
  const lookup = vi.fn().mockResolvedValue([]); await lockActiveCategories(tx(lookup), ["z", "a' unsafe", "z"]);
  const sql = lookup.mock.calls[0][0] as { sql: string; values: string[] };
  expect(sql.sql).toMatch(/ORDER BY "id" FOR SHARE/); expect(sql.sql).not.toContain("a' unsafe"); expect(sql.values).toEqual(["a' unsafe", "z"]); expect(lookup).toHaveBeenCalledTimes(1);
});
it("deactivation completed while waiting is observed after the lock resolves", async () => {
  let resume!: (rows: { id: string; active: boolean }[]) => void;
  const lookup = vi.fn(() => new Promise(resolve => { resume = resolve; })); const selection = lockActiveCategories(tx(lookup), ["candidate"]);
  resume([{ id: "candidate", active: false }]); expect(await selection).toEqual([]);
});
it("reactivation restores eligibility on a new selection without cached state", async () => {
  const lookup = vi.fn().mockResolvedValueOnce([{ id: "same", active: false }]).mockResolvedValueOnce([{ id: "same", active: true }]);
  expect(await lockActiveCategories(tx(lookup), ["same"])).toEqual([]); expect(await lockActiveCategories(tx(lookup), ["same"])).toEqual(["same"]);
});
it("DB failure propagates instead of falling back to inactive content", async () => {
  const error = new Error("database temporarily unavailable"); const lookup = vi.fn().mockRejectedValue(error);
  await expect(lockActiveCategories(tx(lookup), ["one"])).rejects.toBe(error);
});
