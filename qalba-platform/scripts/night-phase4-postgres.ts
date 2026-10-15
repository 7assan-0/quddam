/** Native PostgreSQL 17 Phase 4 acceptance. Synthetic fixtures and real services only.
 * No game-result writes, source mocks, customer data, or existing database reuse.
 * Requires the explicit guarded environment used by night-mvp-fixtures.ts.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { db } from "../src/lib/db";
import { createNightSession, applyNightCommand, getNightView } from "../src/lib/night/service";
import { createInvitation, ownerInvitation, getPublicInvitation, respondToInvitation } from "../src/lib/night/invitation-service";
import { digestCapability, inviteInputSchema, rsvpInputSchema } from "../src/lib/night/invitation";
import { deriveNightHighlights } from "../src/lib/night/highlights";
import type { NightView } from "../src/lib/night/types";
import { isolatedEnvironment, loadFixture } from "./night-mvp-fixtures";
import { completeCanonicalGame } from "./night-mvp-engines";

async function main() {
  const { output } = isolatedEnvironment();
  assert.equal(process.env.ENABLE_NIGHT_OF_QUDDAM, "true");
  const fixture = await loadFixture();
  const run = process.env.NIGHT_PHASE4_RUN ?? "phase4-postgres";
  assert.match(run, /^[a-zA-Z0-9_-]+$/);
  const evidence = join(output, run);
  mkdirSync(evidence, { mode: 0o700 });
  const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const sourceDirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim().length > 0;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const checks: { name: string; passed: boolean }[] = [];
  const concurrency: { scenario: string; independentBackends: number; observedBlocked: number; accepted: number; rejected: number }[] = [];
  const clock = new Date();
  const schedule = { scheduledAt: new Date(clock.getTime() + 3600_000).toISOString(), timezone: "Asia/Riyadh" };
  const games = ["top-list", "ordering-challenge", "survey-show"] as const;
  let currentStep = "initialize", status = "FAILED";
  const privateCases: Record<string, string> = {};
  const wallet = async () => (await db().creditWallet.findUniqueOrThrow({ where: { userId: fixture.ownerId } })).balance;
  const create = () => createNightSession(fixture.ownerId, { key: randomUUID(), games: [...games], teams: ["فريق الاختبار الأول", "فريق الاختبار الثاني"] });
  const command = (night: NightView, op: "START" | "IMPORT" | "NEXT" | "END") => applyNightCommand(fixture.ownerId, night.id, { key: randomUUID(), expectedVersion: night.version, op });
  const code = (path: string) => { const value = path.split("/").at(-1)!; assert.match(value, /^[a-f0-9]{64}$/); return value; };
  const cap = () => randomBytes(32).toString("hex");
  async function invitation() {
    const night = await create();
    const inv = await createInvitation(fixture.ownerId, night.id, schedule);
    return { night, code: code(inv.path) };
  }
  async function check(name: string, fn: () => Promise<unknown>) {
    currentStep = name;
    try { await fn(); checks.push({ name, passed: true }); }
    catch (error) { checks.push({ name, passed: false }); throw error; }
  }
  async function rejects(fn: () => Promise<unknown>, status?: number) {
    await assert.rejects(fn, error => { if (status) assert.equal((error as { status?: number }).status, status); return true; });
  }
  async function blocked(count: number) {
    for (let i = 0; i < 150; i++) {
      const waiting = await pool.query<{ pid: number }>("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%NightSession%' AND query NOT LIKE '%pg_stat_activity%'");
      if (waiting.rows.length >= count) return waiting.rows.map(x => x.pid);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error("Native lock wait was not observed");
  }
  async function race(night: NightView, first: () => Promise<unknown>, second: () => Promise<unknown>, scenario: string) {
    const barrier = await pool.connect();
    try {
      await barrier.query("BEGIN");
      const pid = (await barrier.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      await barrier.query('SELECT "id" FROM "NightSession" WHERE "id"=$1 FOR UPDATE', [night.id]);
      const settle = (fn: () => Promise<unknown>) => fn().then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error }));
      const a = settle(first); await blocked(1);
      const b = settle(second); const waiting = await blocked(2);
      assert.ok(new Set([pid, ...waiting]).size >= 3);
      await barrier.query("COMMIT");
      const outcomes = await Promise.all([a, b]);
      concurrency.push({ scenario, independentBackends: new Set([pid, ...waiting]).size, observedBlocked: waiting.length,
        accepted: outcomes.filter(x => x.ok).length, rejected: outcomes.filter(x => !x.ok).length });
      return outcomes;
    } catch (error) { await barrier.query("ROLLBACK"); throw error; }
    finally { barrier.release(); }
  }
  try {
    const initial = await wallet();
    const planned = await invitation();
    await check("future-invitation-created-without-credit-or-game-room", async () => {
      const night = await getNightView(fixture.ownerId, planned.night.id);
      assert.equal(night.phase, "preparing"); assert.equal(await wallet(), initial);
      assert.equal(await db().nightGame.count({ where: { nightId: night.id, sourceSessionId: { not: null } } }), 0);
      const saved = await db().nightInvitation.findUniqueOrThrow({ where: { nightId: night.id } });
      assert.equal(saved.tokenHash, digestCapability(planned.code)); assert.notEqual(saved.tokenHash, planned.code);
      assert.doesNotMatch(JSON.stringify(saved), new RegExp(planned.code));
    });
    await check("invalid-schedules-zones-and-extra-fields-rejected", async () => {
      for (const input of [{ ...schedule, scheduledAt: "not-a-date" }, { ...schedule, host: true }]) assert.equal(inviteInputSchema.safeParse(input).success, false);
      for (const input of [{ ...schedule, scheduledAt: new Date(clock.getTime() - 1).toISOString() }, { ...schedule, scheduledAt: new Date(clock.getTime() + 91 * 86400_000).toISOString() }, { ...schedule, timezone: "Invalid/Zone" }]) {
        const night = await create(); await rejects(() => createInvitation(fixture.ownerId, night.id, input), 400);
      }
    });
    await check("one-invitation-per-night-under-concurrent-creation", async () => {
      const night = await create();
      const outcomes = await Promise.allSettled([createInvitation(fixture.ownerId, night.id, schedule), createInvitation(fixture.ownerId, night.id, schedule)]);
      assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
      assert.equal(await db().nightInvitation.count({ where: { nightId: night.id } }), 1);
    });
    await check("owner-refresh-never-reveals-link-and-other-owner-denied", async () => {
      const summary = await ownerInvitation(fixture.ownerId, planned.night.id);
      assert.equal(summary.exists, true); assert.doesNotMatch(JSON.stringify(summary), new RegExp(planned.code));
      assert.equal("path" in summary, false); assert.equal("tokenHash" in summary, false);
      await rejects(() => ownerInvitation(fixture.otherOwnerId, planned.night.id), 404);
      await rejects(() => createInvitation(fixture.otherOwnerId, planned.night.id, schedule), 404);
    });
    const attendee = cap();
    await check("anonymous-yes-vote-and-own-capability-projection", async () => {
      const saved = await respondToInvitation(planned.code, { name: "زائر اصطناعي واحد", rsvp: "YES", gameVote: "top-list" }, attendee);
      assert.equal(saved.view.coming, 1); assert.equal(saved.view.mine?.name, "زائر اصطناعي واحد");
      assert.equal(saved.view.games.find(x => x.game === "top-list")?.votes, 1);
      const mine = await getPublicInvitation(planned.code, attendee); assert.equal(mine.view.mine?.rsvp, "YES");
      const stranger = await getPublicInvitation(planned.code, cap()); assert.equal(stranger.view.mine, null);
      assert.doesNotMatch(JSON.stringify(stranger.view), /زائر اصطناعي واحد|capabilityHash|tokenHash|ownerId|sourceSessionId/);
    });
    await check("lost-first-post-retry-preissued-cookie-is-one-attendee", async () => {
      const retry = await respondToInvitation(planned.code, { name: "زائر اصطناعي واحد", rsvp: "YES", gameVote: "top-list" }, attendee);
      assert.equal(retry.view.coming, 1);
      const stored = await db().nightInvitation.findUniqueOrThrow({ where: { nightId: planned.night.id }, include: { guests: true } });
      assert.equal(stored.guests.length, 1); assert.notEqual(stored.guests[0].capabilityHash, attendee);
    });
    await check("vote-update-does-not-duplicate-and-no-clears-ballot", async () => {
      let saved = await respondToInvitation(planned.code, { name: "زائر اصطناعي واحد", rsvp: "YES", gameVote: "survey-show" }, attendee);
      assert.equal(saved.view.coming, 1); assert.equal(saved.view.games.find(x => x.game === "top-list")?.votes, 0);
      assert.equal(saved.view.games.find(x => x.game === "survey-show")?.votes, 1);
      saved = await respondToInvitation(planned.code, { name: "زائر اصطناعي واحد", rsvp: "NO", gameVote: null }, attendee);
      assert.equal(saved.view.coming, 0); assert.equal(saved.view.declined, 1); assert.ok(saved.view.games.every(x => x.votes === 0));
    });
    await check("normalized-duplicate-alias-and-capability-name-change-rejected", async () => {
      await rejects(() => respondToInvitation(planned.code, { name: "  زائر  اصطناعي واحد  ", rsvp: "YES", gameVote: null }, cap()), 409);
      await rejects(() => respondToInvitation(planned.code, { name: "اسم اصطناعي آخر", rsvp: "YES", gameVote: null }, attendee), 409);
      await rejects(() => respondToInvitation(planned.code, { name: "اسم\u202eمضلل", rsvp: "YES", gameVote: null }, cap()), 400);
    });
    await check("unsupported-votes-host-fields-and-no-vote-rejected", async () => {
      for (const input of [{ name: "زائر", rsvp: "YES", gameVote: "unknown" }, { name: "زائر", rsvp: "YES", gameVote: null, host: true }, { name: "زائر", rsvp: "YES", gameVote: null, points: 999 }]) assert.equal(rsvpInputSchema.safeParse(input).success, false);
      await rejects(() => respondToInvitation(planned.code, { name: "زائر مرفوض", rsvp: "NO", gameVote: "top-list" }, cap()), 400);
    });
    await check("concurrent-capacity-bound-32-rejects-33rd", async () => {
      const limited = await invitation();
      const outcomes = await Promise.allSettled(Array.from({ length: 34 }, (_, i) => respondToInvitation(limited.code,
        { name: `زائر سعة اصطناعي ${i + 1}`, rsvp: "YES", gameVote: "top-list" }, cap())));
      assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 32);
      assert.equal(outcomes.filter(x => x.status === "rejected").length, 2);
      assert.equal((await getPublicInvitation(limited.code)).view.coming, 32);
      await rejects(() => respondToInvitation(limited.code, { name: "زائر رقم ثلاثة وثلاثين", rsvp: "YES", gameVote: null }, cap()), 409);
    });
    await check("mutation-rate-60-serialized-even-with-concurrent-requests", async () => {
      const limited = await invitation(), capability = cap();
      const input = { name: "زائر حد الطلبات", rsvp: "YES" as const, gameVote: null };
      const rateNow = new Date();
      await respondToInvitation(limited.code, input, capability, rateNow);
      for (let i = 1; i < 59; i++) await respondToInvitation(limited.code, { ...input, gameVote: i % 2 ? "top-list" : "survey-show" }, capability, rateNow);
      const changed = [{ ...input, rsvp: "NO" as const, gameVote: null }, { ...input, gameVote: "top-list" as const }];
      const final = await Promise.allSettled(changed.map(value => respondToInvitation(limited.code, value, capability, rateNow)));
      assert.equal(final.filter(x => x.status === "fulfilled").length, 1);
      const failed = final.find(x => x.status === "rejected") as PromiseRejectedResult;
      assert.equal((failed.reason as { status: number }).status, 429);
      const winner = final.findIndex(x => x.status === "fulfilled");
      await respondToInvitation(limited.code, changed[winner], capability, rateNow);
      const stored = await db().nightInvitation.findUniqueOrThrow({ where: { nightId: limited.night.id }, include: { guests: true } });
      assert.equal(stored.rateCount, 60); assert.equal(stored.guests.length, 1);
      await respondToInvitation(limited.code, changed[winner === 0 ? 1 : 0], capability, new Date(rateNow.getTime() + 60_000));
    });
    await check("rsvp-before-start-wins-native-lock-order-then-closed", async () => {
      const item = await invitation();
      const outcome = await race(item.night,
        () => respondToInvitation(item.code, { name: "زائر قبل البداية", rsvp: "YES", gameVote: "top-list" }, cap()),
        () => command(item.night, "START"), "RSVP queued before START");
      assert.ok(outcome.every(x => x.ok));
      assert.equal((await getPublicInvitation(item.code)).view.coming, 1);
      assert.equal((await getPublicInvitation(item.code)).view.open, false);
      await rejects(() => respondToInvitation(item.code, { name: "زائر متأخر", rsvp: "YES", gameVote: null }, cap()), 409);
    });
    await check("start-before-rsvp-rejects-under-independent-native-connections", async () => {
      const item = await invitation();
      const outcome = await race(item.night, () => command(item.night, "START"),
        () => respondToInvitation(item.code, { name: "زائر بعد البداية", rsvp: "YES", gameVote: null }, cap()), "START queued before RSVP");
      assert.equal(outcome[0].ok, true); assert.equal(outcome[1].ok, false);
      assert.equal((outcome[1] as { error: { status: number } }).error.status, 409);
      assert.equal((await getPublicInvitation(item.code)).view.coming, 0);
    });
    await check("expiry-boundary-checked-after-lock-acquisition", async () => {
      const item = await invitation();
      const stored = await db().nightInvitation.findUniqueOrThrow({ where: { nightId: item.night.id } });
      await respondToInvitation(item.code, { name: "زائر قبل الانتهاء", rsvp: "YES", gameVote: null }, cap(), new Date(stored.expiresAt.getTime() - 1));
      const barrier = await pool.connect();
      try {
        await barrier.query("BEGIN");
        await barrier.query('SELECT "id" FROM "NightSession" WHERE "id"=$1 FOR UPDATE', [item.night.id]);
        const response = respondToInvitation(item.code, { name: "زائر عند الانتهاء", rsvp: "YES", gameVote: null }, cap(), stored.expiresAt).then(() => false, error => (error as { status: number }).status === 409);
        await blocked(1); await barrier.query("COMMIT"); assert.equal(await response, true);
      } finally { await barrier.query("ROLLBACK"); barrier.release(); }
      assert.equal((await getPublicInvitation(item.code, undefined, stored.expiresAt)).view.open, false);
    });
    await check("real-clock-expiry-crossed-while-waiting-on-native-lock", async () => {
      const item = await invitation();
      const barrier = await pool.connect();
      try {
        // Invitation-only synthetic fixture clock, never a source-game or customer record.
        const expiry = new Date(Date.now() + 800);
        await db().nightInvitation.update({ where: { nightId: item.night.id }, data: { expiresAt: expiry } });
        await barrier.query("BEGIN");
        await barrier.query('SELECT "id" FROM "NightSession" WHERE "id"=$1 FOR UPDATE', [item.night.id]);
        const response = respondToInvitation(item.code, { name: "زائر انتظار انتهاء", rsvp: "YES", gameVote: null }, cap())
          .then(() => false, error => (error as { status: number }).status === 409);
        await blocked(1);
        await new Promise(resolve => setTimeout(resolve, Math.max(0, expiry.getTime() - Date.now() + 50)));
        await barrier.query("COMMIT"); assert.equal(await response, true);
        const saved = await db().nightInvitation.findUniqueOrThrow({ where: { nightId: item.night.id }, include: { guests: true } });
        assert.equal(saved.guests.length, 0);
      } finally { await barrier.query("ROLLBACK"); barrier.release(); }
    });
    await check("advisory-ballots-preserve-game-order-and-all-planning-credit-neutral", async () => {
      const after = await getNightView(fixture.ownerId, planned.night.id);
      assert.deepEqual(after.games.map(g => g.game), games); assert.equal(await wallet(), initial);
    });
    await check("complete-final-tie-from-three-canonical-engines-and-real-highlights", async () => {
      let night = await create();
      night = await command(night, "START");
      for (const [index, outcome] of (["A", "TIE", "B"] as const).entries()) {
        const id = night.current?.hostHref?.split("/").at(-1); assert.ok(id);
        await completeCanonicalGame(id, fixture.ownerId, games[index], outcome);
        night = await command(night, "IMPORT");
        if (index < 2) night = await command(night, "NEXT");
      }
      assert.equal(night.phase, "completed"); assert.deepEqual(night.teams.map(t => night.totals[t.id]), [8, 8]);
      assert.equal(night.winnerIds.length, 2);
      const highlights = deriveNightHighlights(night)!;
      assert.equal(highlights.played, 3); assert.equal(highlights.championNames.length, 2);
      assert.ok(highlights.facts.some(x => x.includes("تعادل")));
      assert.doesNotMatch(JSON.stringify(highlights), /sourceSessionId|snapshot|answers|capability|token/);
      assert.equal(await wallet(), initial - 3); privateCases.tieNightId = night.id;
    });
    await check("early-ended-highlight-has-no-champion-no-credit-and-immutable-order", async () => {
      let night = await create(); night = await command(night, "START"); night = await command(night, "END");
      const highlights = deriveNightHighlights(night)!;
      assert.equal(highlights.phase, "ended"); assert.equal(highlights.played, 0); assert.deepEqual(highlights.championNames, []);
      assert.deepEqual(night.winnerIds, []); assert.equal(await wallet(), initial - 3); privateCases.endedNightId = night.id;
    });
    writeFileSync(join(evidence, "cases.private.json"), JSON.stringify(privateCases), { mode: 0o600, flag: "wx" });
    status = "PASSED";
  } catch {
    // Never serialize arbitrary exception text, Prisma errors, IDs, URLs or answers.
  } finally {
    await pool.end(); await db().$disconnect();
    const receipt = { schemaVersion: 1, sourceHead, sourceDirty, syntheticOnly: true, nativePostgres: true, mocks: false,
      status, passed: checks.filter(x => x.passed).length, failed: checks.filter(x => !x.passed).length,
      failureStep: status === "PASSED" ? null : currentStep, checks, concurrency, finishedAt: new Date().toISOString() };
    writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2), { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ status, passed: receipt.passed, failed: receipt.failed, failureStep: receipt.failureStep, nativePostgres: true }));
    if (status !== "PASSED") process.exitCode = 1;
  }
}
main().catch(() => { console.error("Phase 4 native acceptance failed before sanitized receipt; private values withheld."); process.exitCode = 1; });
