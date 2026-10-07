/** Dedicated native PostgreSQL only. No production DB; no provider network calls. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { db } from "../src/lib/db";
import { authBudget, consumePublicAuthAttempt, pruneAuthAttempts } from "../src/lib/auth/abuse";
import { ensureWelcomeCredits } from "../src/lib/billing/credits";

type Action = "register" | "login" | "admin-login" | "forgot" | "reset";
async function main() {
  if (process.env.AUTH_ABUSE_TEST_DATABASE !== "1" || Number(process.env.DATABASE_POOL_MAX) < 4) throw new Error("Requires dedicated native PostgreSQL and pool >= 4");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const server = (await pool.query("SELECT version() AS version")).rows[0].version as string;
  assert.match(server, /^PostgreSQL /); assert.doesNotMatch(server, /PGlite/i);
  const results: object[] = [], now = new Date("2026-10-06T00:00:00Z");
  const email = (suffix: string | number) => `fixture-${suffix}@example.test`;
  const request = (client: string) => new Request("http://localhost", { headers: { "x-quddam-client-ip": client } });
  const attempt = (identity: string, client: string, action: Action = "register", when = now) => consumePublicAuthAttempt(request(client), identity, action, when);
  const clear = () => db().authAttempt.deleteMany({});
  const snapshot = () => db().authAttempt.findMany({ orderBy: { key: "asc" }, select: { key: true, count: true, windowStart: true } });
  async function check(name: string, run: () => Promise<object>) {
    await clear(); const start = Date.now();
    try { const evidence = await run(); results.push({ name, status: "passed", durationMs: Date.now() - start, ...evidence }); console.log("PASS", name); }
    catch (error) { results.push({ name, status: "failed", durationMs: Date.now() - start }); throw error; }
  }
  try {
    process.env.AUTH_TRUST_PROXY = "true"; process.env.AUTH_CLIENT_IP_HEADER = "x-quddam-client-ip";
    await check("A repeated email bounded; denial does not extend fixed recovery", async () => {
      const values = []; for (let i = 0; i < 9; i++) values.push(await attempt(email("one"), "192.0.2.1"));
      assert.deepEqual(values, [...Array(8).fill(true), false]);
      const before = await snapshot();
      assert.equal(await attempt(email("one"), "192.0.2.1", "register", new Date(now.getTime() + 59 * 60_000)), false);
      assert.deepEqual(await snapshot(), before);
      assert.equal(await attempt(email("one"), "192.0.2.1", "register", new Date(now.getTime() + 3600_000)), true);
      return { admitted: 8, denied: 2, recoveredAtHourBoundary: true };
    });
    await check("B rotating distinct emails cannot bypass a client burst cap", async () => {
      const values = []; for (let i = 0; i < 13; i++) values.push(await attempt(email(i), "192.0.2.2"));
      assert.equal(values.filter(Boolean).length, 12); assert.equal(values[12], false);
      const rows = await snapshot(); assert(rows.every(r => r.count <= 12));
      return { distinctEmails: 13, admitted: 12, denied: 1, countersCapped: true };
    });
    await check("C household bursts and different normal clients remain viable", async () => {
      for (let c = 3; c < 5; c++) for (let i = 0; i < 4; i++) assert.equal(await attempt(email(`${c}-${i}`), `192.0.2.${c}`), true);
      return { clients: 2, householdRegistrationsEach: 4, admitted: 8 };
    });
    await check("D global registration budget also bounds distributed clients", async () => {
      for (let i = 0; i < 60; i++) assert.equal(await attempt(email(`global-${i}`), `198.51.100.${i + 1}`), true);
      const before = await snapshot(); assert.equal(await attempt(email("global-over"), "198.51.100.100"), false);
      assert.deepEqual(await snapshot(), before);
      assert.equal(await attempt(email("global-recover"), "198.51.100.101", "register", new Date(now.getTime() + 60_000)), true);
      return { admitted: 60, deniedAtGlobalCap: true, allLayerRollback: true, recoveredAtMinuteBoundary: true };
    });
    await check("E sustained client cap remains after burst windows reopen", async () => {
      for (let i = 0; i < 60; i++) assert.equal(await attempt(email(`sustained-${i}`), "192.0.2.5", "register", new Date(now.getTime() + Math.floor(i / 12) * 60_000)), true);
      assert.equal(await attempt(email("sustained-over"), "192.0.2.5", "register", new Date(now.getTime() + 5 * 60_000)), false);
      assert.equal(await attempt(email("sustained-recover"), "192.0.2.5", "register", new Date(now.getTime() + 3600_000)), true);
      return { admittedPerHour: 60, burstResetDidNotBypassSustainedCap: true };
    });
    for (const [action, cap] of [["login", 8], ["forgot", 3], ["reset", 5], ["admin-login", 5]] as const) {
      await check(`F ${action} fixed recovery and victim/client isolation`, async () => {
        for (let i = 0; i < cap; i++) assert.equal(await attempt(email(action), "192.0.2.10", action), true);
        const before = await snapshot(); assert.equal(await attempt(email(action), "192.0.2.10", action), false); assert.deepEqual(await snapshot(), before);
        assert.equal(await attempt(email(action), "192.0.2.11", action), true);
        assert.equal(await attempt(email(action), "192.0.2.10", action, new Date(now.getTime() + 15 * 60_000)), true);
        return { cap, alternateClientAdmitted: true, recoveredAt15Minutes: true, denialDidNotExtendWindow: true };
      });
    }
    await check("G untrusted spoofed forwarding headers cannot bypass or poison client buckets", async () => {
      process.env.AUTH_TRUST_PROXY = "false";
      try {
        for (let i = 0; i < 12; i++) {
          const req = new Request("http://localhost", { headers: { "x-forwarded-for": `203.0.113.${i + 1}`, "x-quddam-client-ip": `192.0.2.${i + 1}` } });
          assert.equal(await consumePublicAuthAttempt(req, email(`spoof-${i}`), "register", now), true);
        }
        assert.equal(await consumePublicAuthAttempt(request("203.0.113.99"), email("spoof-over"), "register", now), false);
      } finally { process.env.AUTH_TRUST_PROXY = "true"; }
      return { spoofedHeadersIgnored: true, admitted: 12, denied: 1 };
    });
    await check("H parallel contenders on native backends cannot exceed a shared budget", async () => {
      const gate = await pool.connect(); await gate.query("BEGIN"); await gate.query('LOCK TABLE "AuthAttempt" IN SHARE MODE');
      const tasks = Array.from({ length: 20 }, (_, i) => attempt(email(`race-${i}`), "192.0.2.30"));
      const joined = Promise.all(tasks); let pids: number[] = [];
      try {
        const until = Date.now() + 5000;
        while (Date.now() < until) {
          const waiters = await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%AuthAttempt%'");
          pids = waiters.rows.map(r => Number(r.pid));
          if (pids.length >= 4) break;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert(pids.length >= 4); assert.equal(new Set(pids).size, pids.length);
        await gate.query("COMMIT");
      } catch (error) { await gate.query("ROLLBACK"); await Promise.allSettled(tasks); throw error; }
      finally { gate.release(); }
      const values = await joined;
      assert.equal(values.filter(Boolean).length, 12); assert.equal(values.filter(v => !v).length, 8);
      const clientKeys = authBudget(request("192.0.2.30"), email("race-0"), "register").filter(r => r.scope === "client").map(r => r.key);
      const rows = await db().authAttempt.findMany({ where: { key: { in: clientKeys } } }); assert(rows.every(r => r.count === 12));
      return { backendPids: pids, attempted: 20, admitted: 12, denied: 8, clientCounterCounts: rows.map(r => r.count) };
    });
    await db().featureFlag.upsert({ where: { key: "welcome-credits" }, create: { key: "welcome-credits", enabled: true, config: { count: 3 } }, update: { enabled: true, config: { count: 3 } } });
    await check("I one eligible welcome ledger entry and grant under parallel retries", async () => {
      process.env.PUBLIC_WELCOME_CREDITS_ENABLED = "true";
      const user = await db().user.create({ data: { email: email(randomUUID()), name: "Eligible fixture" } });
      await Promise.all(Array.from({ length: 8 }, () => db().$transaction(tx => ensureWelcomeCredits(tx, user.id))));
      await db().$transaction(tx => ensureWelcomeCredits(tx, user.id));
      const entries = await db().gameCredit.findMany({ where: { idempotencyKey: `welcome:${user.id}` } });
      const wallet = await db().creditWallet.findUniqueOrThrow({ where: { userId: user.id } });
      assert.equal(entries.length, 1); assert.equal(entries[0].delta, 3); assert.equal(wallet.balance, 3);
      return { parallelRetries: 8, ledgerEntries: 1, delta: 3, walletBalance: 3 };
    });
    await check("J default/disabled public gate grants zero without retroactive or duplicate grants", async () => {
      delete process.env.PUBLIC_WELCOME_CREDITS_ENABLED;
      const user = await db().user.create({ data: { email: email(randomUUID()), name: "Ineligible fixture" } });
      await Promise.all(Array.from({ length: 4 }, () => db().$transaction(tx => ensureWelcomeCredits(tx, user.id))));
      process.env.PUBLIC_WELCOME_CREDITS_ENABLED = "true";
      await db().$transaction(tx => ensureWelcomeCredits(tx, user.id));
      const entries = await db().gameCredit.findMany({ where: { idempotencyKey: `welcome:${user.id}` } });
      assert.equal(entries.length, 1); assert.equal(entries[0].delta, 0);
      assert.equal((await db().creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance, 0);
      return { defaultGateDisabled: true, ledgerEntries: 1, delta: 0, noRetroactiveGrant: true };
    });
    await check("K existing disabled FeatureFlag also denies free entitlement", async () => {
      process.env.PUBLIC_WELCOME_CREDITS_ENABLED = "true";
      await db().featureFlag.update({ where: { key: "welcome-credits" }, data: { enabled: false } });
      const user = await db().user.create({ data: { email: email(randomUUID()), name: "Flag disabled fixture" } });
      await db().$transaction(tx => ensureWelcomeCredits(tx, user.id));
      assert.equal((await db().creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance, 0);
      const entries = await db().gameCredit.findMany({ where: { idempotencyKey: `welcome:${user.id}` } }); assert.equal(entries.length, 1); assert.equal(entries[0].delta, 0);
      return { existingFeatureFlagRespected: true, delta: 0 };
    });
    await check("L indexed pseudonymous retention is bounded and preserves active counters", async () => {
      const hash = (label: string) => createHash("sha256").update(label).digest("hex");
      await db().authAttempt.createMany({ data: Array.from({ length: 507 }, (_, i) => ({ key: hash(`old-${i}`), count: 1, windowStart: new Date(now.getTime() - 49 * 3600_000) })) });
      await db().authAttempt.create({ data: { key: hash("active"), count: 2, windowStart: now } });
      assert.equal(await pruneAuthAttempts(db(), now), 500); assert.equal(await db().authAttempt.count(), 8);
      assert.equal(await pruneAuthAttempts(db(), now), 7); assert.equal(await db().authAttempt.count(), 1);
      assert.equal((await db().authAttempt.findUniqueOrThrow({ where: { key: hash("active") } })).count, 2);
      const indexes = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename='AuthAttempt'");
      assert(indexes.rows.some(r => r.indexname === "AuthAttempt_windowStart_idx"));
      return { expired: 507, firstBatch: 500, secondBatch: 7, activePreserved: true, indexPresent: true };
    });
  } finally {
    await writeFile(process.env.AUTH_ABUSE_EVIDENCE_FILE ?? "auth-abuse-postgres.json", JSON.stringify({ server, sourceFingerprint: process.env.SOURCE_FINGERPRINT, results, passed: results.filter((r: object) => (r as { status: string }).status === "passed").length, failed: results.filter((r: object) => (r as { status: string }).status === "failed").length }, null, 2));
    await db().$disconnect(); await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
