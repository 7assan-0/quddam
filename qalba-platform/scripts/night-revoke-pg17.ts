/**
 * Owner-authorized Night invite revocation vs TWO independent RSVP transactions.
 * Native PostgreSQL17 / real Prisma services. Never accepts customer or production DB.
 * The tests use an explicit ephemeral Night fixture and an external 0600 env file.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { db } from "../src/lib/db";
import { createNightSession } from "../src/lib/night/service";
import { createInvitation, getPublicInvitation, ownerInvitation, respondToInvitation, revokeInvitation } from "../src/lib/night/invitation-service";
import { isolatedEnvironment, loadFixture } from "./night-mvp-fixtures";

type Settled = { ok: true; value: unknown } | { ok: false; error: unknown };
const settle = (call: () => Promise<unknown>): Promise<Settled> =>
  call().then(value => ({ ok: true, value }), error => ({ ok: false, error }));
const cap = () => randomBytes(32).toString("hex");

async function main() {
  const { output, databaseName } = isolatedEnvironment();
  assert.equal(process.env.ENABLE_NIGHT_OF_QUDDAM, "true");
  assert.equal(process.env.DATABASE_POOL_MAX ?? "10", "10", "Four independent backend sessions required");
  const fixture = await loadFixture();
  const evidence = join(output, "revoke-pg17");
  mkdirSync(evidence, { mode: 0o700 });
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const checks: { name: string; passed: boolean }[] = [];
  const races: { ordering: string; distinctBackendCount: number; lockWaiters: number; rsvpAccepted: number; rsvpRejected: number; revokeAccepted: number }[] = [];
  let step = "identity", passed = false;
  async function check(name: string, f: () => Promise<void>) {
    step = name;
    try { await f(); checks.push({ name, passed: true }); }
    catch (error) { checks.push({ name, passed: false }); throw error; }
  }
  async function newInvite() {
    const night = await createNightSession(fixture.ownerId, {
      key: randomUUID(), games: ["top-list", "ordering-challenge", "survey-show"],
      teams: ["فريق تجربة أول", "فريق تجربة ثان"],
    });
    const invitation = await createInvitation(fixture.ownerId, night.id, {
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(), timezone: "Asia/Riyadh",
    });
    const code = invitation.path.split("/").at(-1)!;
    assert.match(code, /^[a-f0-9]{64}$/);
    return { night, code };
  }
  async function waitingFor(count: number) {
    for (let attempt = 0; attempt < 180; attempt++) {
      const waiting = await pool.query<{ pid: number }>(
        "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%NightSession%' AND query NOT LIKE '%pg_stat_activity%'");
      const pids = [...new Set(waiting.rows.map(row => row.pid))];
      if (pids.length >= count) return pids;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error("Expected native PostgreSQL row-lock queue not observed");
  }
  async function race(nightId: string, calls: [() => Promise<unknown>, () => Promise<unknown>, () => Promise<unknown>], ordering: string) {
    const barrier = await pool.connect();
    let released = false;
    let pending: Promise<Settled>[] = [];
    try {
      await barrier.query("BEGIN");
      const barrierPid = (await barrier.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      await barrier.query('SELECT "id" FROM "NightSession" WHERE "id"=$1 FOR UPDATE', [nightId]);
      // Three separate Prisma transactions must demonstrably wait behind one
      // real PG17 row lock; starting a Promise is NOT sufficient evidence.
      for (let i = 0; i < calls.length; i++) {
        pending.push(settle(calls[i]));
        await waitingFor(i + 1);
      }
      const pids = await waitingFor(3);
      assert.equal(new Set([barrierPid, ...pids]).size, 4);
      await barrier.query("COMMIT"); released = true;
      const outcomes = await Promise.all(pending);
      races.push({ ordering, distinctBackendCount: 4, lockWaiters: pids.length,
        rsvpAccepted: outcomes.filter((x, i) => i !== (ordering === "revoke-first" ? 0 : 2) && x.ok).length,
        rsvpRejected: outcomes.filter((x, i) => i !== (ordering === "revoke-first" ? 0 : 2) && !x.ok).length,
        revokeAccepted: outcomes.filter((x, i) => i === (ordering === "revoke-first" ? 0 : 2) && x.ok).length });
      return outcomes;
    } finally {
      if (!released) await barrier.query("ROLLBACK").catch(() => {});
      barrier.release();
      await Promise.allSettled(pending);
    }
  }
  const yes = (name: string) => ({ name, rsvp: "YES" as const, gameVote: "top-list" as const });
  try {
    await check("isolated-native-PG17-and-fixture-marker", async () => {
      const id = await pool.query<{ database: string; version_num: number; users: number }>(
        'SELECT current_database() AS database, current_setting(\'server_version_num\')::int AS version_num, (SELECT count(*)::int FROM "User") AS users');
      assert.equal(id.rows[0].database, databaseName);
      assert.ok(id.rows[0].version_num >= 170000 && id.rows[0].version_num < 180000);
      assert.equal(id.rows[0].users, 3);
    });
    const initialBalance = (await db().creditWallet.findUniqueOrThrow({ where: { userId: fixture.ownerId } })).balance;
    const initialDebits = await db().gameCredit.count({ where: { userId: fixture.ownerId, delta: -1 } });
    await check("two-RSVP-queued-before-revoke-both-commit-then-link-invalid", async () => {
      const inv = await newInvite();
      const result = await race(inv.night.id, [
        () => respondToInvitation(inv.code, yes("ضيف الاختبار الأول"), cap()),
        () => respondToInvitation(inv.code, yes("ضيف الاختبار الثاني"), cap()),
        () => revokeInvitation(fixture.ownerId, inv.night.id),
      ], "two-rsvp-first");
      assert.ok(result.every(x => x.ok), "both early RSVPs and final revocation must commit");
      const saved = await db().nightInvitation.findUniqueOrThrow({ where: { nightId: inv.night.id }, include: { guests: true } });
      assert.equal(saved.status, "revoked");
      assert.equal(saved.guests.length, 2);
      assert.equal(new Set(saved.guests.map(g => g.nameKey)).size, 2);
      const owner = await ownerInvitation(fixture.ownerId, inv.night.id);
      assert.equal(owner.exists, true); if (!owner.exists) throw Error("missing invitation");
      assert.equal(owner.status, "revoked"); assert.equal(owner.coming, 2);
      assert.equal(owner.votes.find(v => v.game === "top-list")?.count, 2);
      await assert.rejects(() => getPublicInvitation(inv.code), error => (error as { status?: number }).status === 404);
      await assert.rejects(() => respondToInvitation(inv.code, yes("ضيف متأخر"), cap()),
        error => (error as { status?: number }).status === 409);
      assert.equal((await db().nightInvitation.findUniqueOrThrow({ where: { nightId: inv.night.id }, include: { guests: true } })).guests.length, 2);
    });
    await check("revoke-queued-before-two-RSVP-rejects-both-even-replay", async () => {
      const inv = await newInvite();
      const result = await race(inv.night.id, [
        () => revokeInvitation(fixture.ownerId, inv.night.id),
        () => respondToInvitation(inv.code, yes("ضيف ممنوع واحد"), cap()),
        () => respondToInvitation(inv.code, yes("ضيف ممنوع اثنين"), cap()),
      ], "revoke-first");
      assert.equal(result[0].ok, true);
      for (const outcome of result.slice(1)) {
        assert.equal(outcome.ok, false);
        if (!outcome.ok) assert.equal((outcome.error as { status?: number }).status, 409);
      }
      const saved = await db().nightInvitation.findUniqueOrThrow({ where: { nightId: inv.night.id }, include: { guests: true } });
      assert.equal(saved.status, "revoked"); assert.equal(saved.guests.length, 0);
      assert.deepEqual(await revokeInvitation(fixture.ownerId, inv.night.id), { revoked: true });
      assert.equal((await db().nightInvitation.findUniqueOrThrow({ where: { nightId: inv.night.id } })).status, "revoked");
      await assert.rejects(() => getPublicInvitation(inv.code), error => (error as { status?: number }).status === 404);
      const summary = await ownerInvitation(fixture.ownerId, inv.night.id);
      assert.equal(summary.exists, true); if (!summary.exists) throw Error("missing summary");
      assert.equal(summary.coming, 0); assert.equal(summary.status, "revoked");
    });
    await check("foreign-owner-denied-and-no-credit-or-source-game-side-effects", async () => {
      const inv = await newInvite();
      await assert.rejects(() => revokeInvitation(fixture.otherOwnerId, inv.night.id),
        error => (error as { status?: number }).status === 404);
      assert.equal((await getPublicInvitation(inv.code)).view.open, true);
      assert.equal(await db().gameCredit.count({ where: { userId: fixture.ownerId, delta: -1 } }), initialDebits);
      assert.equal((await db().creditWallet.findUniqueOrThrow({ where: { userId: fixture.ownerId } })).balance, initialBalance);
      assert.equal(await db().nightGame.count({ where: { sourceSessionId: { not: null }, night: { ownerId: fixture.ownerId } } }), 0);
    });
    passed = true;
  } finally {
    await pool.end();
    await db().$disconnect();
    const receipt = { sourceHead: head, syntheticOnly: true, nativePostgres17: true,
      noMocks: true, status: passed ? "PASSED" : "FAILED", failureStep: passed ? null : step,
      checks, races, privateIdsLinksCredentialsWithheld: true };
    writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2), { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ status: receipt.status, passed: checks.filter(x => x.passed).length,
      failed: checks.filter(x => !x.passed).length, failureStep: receipt.failureStep, races }));
  }
}
main().catch(() => { console.error("Native Night revocation acceptance failed (no private values printed)."); process.exitCode = 1; });
