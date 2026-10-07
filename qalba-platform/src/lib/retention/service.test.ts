import { expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { runRetention } from "./service";
import { decodeRetentionCursor, type RetentionKind } from "./policy";

function fixture(kinds: RetentionKind[] = ["AuthSession", "SocialParticipant"]) {
  const rows = kinds.map((kind, i) => ({ id: `id-${i}`, kind, eligibleAt: new Date("2026-01-01Z"), sessionId: kind === "SocialParticipant" ? "session" : null, roomId: null }));
  let writes = 0, transactions = 0, discovered = false;
  const remaining = new Set(rows.map(r => r.id)), ineligible = new Set<string>(), unavailable = new Set<string>();
  const mutations: string[] = [];
  const client = {
    async $queryRawUnsafe(sql: string, ...args: unknown[]) {
      if (!discovered) { discovered = true; return rows; }
      if (sql.includes("FOR UPDATE")) return unavailable.has(String(args[0])) ? [] : [{ id: args[0] }];
      return rows.filter(r => r.id === args[8] && remaining.has(r.id) && !ineligible.has(r.id));
    },
    async $executeRawUnsafe(sql: string, ...args: unknown[]) { writes++; mutations.push(sql); remaining.delete(String(args.at(-1))); return 1; },
    async $transaction<T>(callback: (tx: unknown) => Promise<T>) { transactions++; return callback(client); },
  };
  return { client: client as unknown as PrismaClient, rows, remaining, ineligible, unavailable, mutations, stats: () => ({ writes, transactions }) };
}
it("dry-run uses eligibility with zero writes and contains only aggregate/opaque metadata", async () => {
  const f = fixture(), r = await runRetention({ dryRun: true }, f.client);
  expect(r.eligible).toBe(2); expect(r.deleted + r.redacted).toBe(0); expect(f.stats().writes).toBe(0);
  expect(JSON.stringify(r)).not.toMatch(/password|tokenHash|secretWord|choice|voterId/);
});
it("caps candidate processing across all classes and returns a stable continuation", async () => {
  const f = fixture(["AuthSession", "AuthSession", "AuthSession"]), r = await runRetention({ batchSize: 2 }, f.client);
  expect(r.scanned).toBe(2); expect(r.deleted).toBe(2); expect(f.stats().transactions).toBe(2); expect(r.hasMore).toBe(true);
  expect(decodeRetentionCursor(r.nextCursor!)).toMatchObject({ id: "id-1", kind: "AuthSession" });
});
it("skips a record that became ineligible after discovery", async () => {
  const f = fixture(); f.ineligible.add("id-1"); const r = await runRetention({}, f.client);
  expect(r.deleted).toBe(1); expect(r.redacted).toBe(0); expect(r.skipped).toBe(1); expect(f.remaining.has("id-1")).toBe(true);
});
it("skips locked parent without issuing a destructive statement", async () => {
  const f = fixture(["SocialParticipant"]); f.unavailable.add("session"); const r = await runRetention({}, f.client);
  expect(r.skipped).toBe(1); expect(f.stats().writes).toBe(0);
});
it("repeated cleanup does not repeat a deleted or redacted record", async () => {
  const f = fixture(); const first = await runRetention({}, f.client), second = await runRetention({}, f.client);
  expect(first.deleted + first.redacted).toBe(2); expect(second.deleted + second.redacted).toBe(0); expect(f.stats().writes).toBe(2);
});
it("handles one infrastructure failure without exposing its private error", async () => {
  const f = fixture(); const old = f.client.$transaction.bind(f.client); let first = true;
  f.client.$transaction = (async (...args: Parameters<typeof old>) => { if (first) { first = false; throw Error("token=private provider-secret"); } return old(...args); }) as typeof f.client.$transaction;
  const r = await runRetention({}, f.client); expect(r.failed).toBe(1); expect(r.redacted).toBe(1);
  expect(JSON.stringify(r)).not.toContain("provider-secret"); expect(JSON.stringify(r)).not.toContain("token=");
});
