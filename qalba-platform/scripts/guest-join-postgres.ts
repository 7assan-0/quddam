/** Native shared-PostgreSQL acceptance. Only an explicitly authorized fresh loopback DB. */
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { consumeJoinAdmission, joinAdmissionBudget } from "../src/lib/rooms/admission";

async function main() {
  assert.equal(process.env.JOIN_TEST_DATABASE, "1", "Explicit test authorization required");
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Loopback PostgreSQL only");
  assert.equal(url.port, "55466");
  assert.equal(url.pathname, "/join_admission_test");
  assert.equal(decodeURIComponent(url.username), "join_admission_test");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert.equal(process.env.AUTH_TRUST_PROXY, "true");
  assert.equal(process.env.AUTH_CLIENT_IP_HEADER, "x-quddam-client-ip");
  assert.ok((process.env.AUTH_RATE_LIMIT_SECRET?.length ?? 0) >= 24);
  const client = db();
  try {
    const identity = await client.$queryRaw<Array<{ name: string; role: string }>>`SELECT current_database() AS name, current_user AS role`;
    assert.equal(identity[0].name, "join_admission_test");
    assert.equal(identity[0].role, "join_admission_test");
    const before = await client.authAttempt.count();
    assert.equal(before, 0, "Test requires a fresh, dedicated empty admission table; no resets permitted");
    const request = (ip: string, forged?: string) => new Request("https://quddam.test/api/rooms/7K4P2Q/join", {
      headers: { "x-quddam-client-ip": ip, "x-forwarded-for": forged ?? "198.51.100.1" },
    });
    const first = request("203.0.113.20");
    const outcomes = await Promise.all(Array.from({ length: 14 }, (_, i) =>
      consumeJoinAdmission(request("203.0.113.20", i % 2 ? "1.2.3.4" : "5.6.7.8"),
        "board", i % 2 ? " 7k4p2q " : "7K4P2Q")));
    assert.equal(outcomes.filter(Boolean).length, 12, "Exactly twelve parallel admissions per canonical room/client");
    assert.equal(outcomes.filter(value => !value).length, 2);
    for (const limit of joinAdmissionBudget(first, "board", "7K4P2Q")) {
      const rows = await client.$queryRaw<Array<{ count: number }>>`SELECT "count" FROM "AuthAttempt" WHERE "key" = ${limit.key}`;
      assert.equal(rows.length, 1, "Every shared layer must be present");
      assert.equal(rows[0].count, 12, "Rejected transactions must roll back every earlier increment");
    }
    assert.equal(await consumeJoinAdmission(request("203.0.113.20", "9.9.9.9"), "board", "7K4P2Q"), false);
    const second = await Promise.all(Array.from({ length: 10 }, () =>
      consumeJoinAdmission(first, "board", "8K4P2Q")));
    assert.equal(second.filter(Boolean).length, 10, "Distinct room subject must retain an independent room-client budget");
    const third = await Promise.all(Array.from({ length: 10 }, () =>
      consumeJoinAdmission(request("203.0.113.21"), "board", "7K4P2Q")));
    assert.equal(third.filter(Boolean).length, 10, "Distinct trusted clients retain independent client budgets");
    // This test proves atomic shared-table limits under concurrent calls. It
    // does not attest to the deployed proxy, multiple app replicas or load capacity.
    console.log(JSON.stringify({ scope: "dedicated synthetic native PostgreSQL join admission",
      passed: true, canonicalParallelAccepted: 12, canonicalParallelRejected: 2,
      distinctRoomAccepted: 10, distinctClientAccepted: 10, liveIngressVerified: false }));
  } finally { await client.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Native join test failed"); process.exitCode = 1; });
