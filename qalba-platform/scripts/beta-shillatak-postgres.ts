/** Reproducible native PostgreSQL 17 Shillatak acceptance, guarded synthetic DB only.
 * Canonical games are played through existing services (5/7/5 rounds). The only
 * SQL result-corruption attempts are rejected and rolled back; mutated native
 * receipt clones exist only in memory for validator defense-in-depth checks.
 * No application mocks, direct grants, source-game writes, or old DB resets.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import { db } from "../src/lib/db";
import { applyNightCommand, createNightSession } from "../src/lib/night/service";
import type { NightView } from "../src/lib/night/types";
import { acceptShillaInvite, archiveShilla, attachShillaNight, createShilla,
  createShillaInvite, getShillaView, leaveShilla, listMyShillas,
  previewShillaInvite, revokeShillaInvite } from "../src/lib/shillatak/service";
import { attachNightSchema, completedSnapshot, digest } from "../src/lib/shillatak/rules";
import { isolatedEnvironment } from "./night-mvp-fixtures";
import { createBetaNativeOwner, loadBetaFixture } from "./beta-fixtures";
import { completeCanonicalGame } from "./night-mvp-engines";

type Outcome = { ok: true; value: unknown } | { ok: false; error: unknown };
const teams: [string, string] = ["فريق القبول الأول", "فريق القبول الثاني"];
const games = ["top-list", "ordering-challenge", "survey-show"] as const;
async function main() {
  const { output } = isolatedEnvironment();
  assert.equal(process.env.ENABLE_SHILLATAK, "true");
  assert.equal(process.env.ENABLE_NIGHT_OF_QUDDAM, "true");
  const fixture = await loadBetaFixture(), members = fixture.memberIds;
  const run = process.env.BETA_NATIVE_RUN ?? "beta-shillatak-postgres";
  assert.match(run, /^[a-zA-Z0-9_-]+$/);
  const evidence = join(output, run); mkdirSync(evidence, { mode: 0o700 });
  const owner = await createBetaNativeOwner();
  const sourceHead = execFileSync("git", ["--no-replace-objects", "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const sourceDirty = !!execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, application_name: "beta-native-barrier" });
  const checks: { name: string; passed: boolean }[] = [];
  const concurrency: { scenario: string; independentBackends: number; observedBlocked: number; accepted: number; rejected: number }[] = [];
  const privateCases: Record<string, unknown> = {};
  let status = "FAILED", currentStep = "initialize", failureClass: string | null = null, failureCode: string | null = null;
  const wallet = async () => (await db().creditWallet.findUniqueOrThrow({ where: { userId: owner } })).balance;
  const creditCount = async () => db().gameCredit.count({ where: { userId: owner } });
  const create = (who = owner, names = teams) => createNightSession(who, { key: randomUUID(), games: [...games], teams: names });
  const command = (night: NightView, op: "START" | "IMPORT" | "NEXT" | "END") => applyNightCommand(owner, night.id,
    { key: randomUUID(), expectedVersion: night.version, op });
  const codeOf = (path: string) => { const code = path.split("/").at(-1)!; assert.match(code, /^[a-f0-9]{64}$/); return code; };
  async function check(name: string, fn: () => Promise<unknown>) {
    currentStep = name;
    try { await fn(); checks.push({ name, passed: true }); }
    catch (error) { checks.push({ name, passed: false }); throw error; }
  }
  async function rejects(fn: () => Promise<unknown>, expectedStatus?: number, expectedCode?: string) {
    await assert.rejects(fn, error => {
      if (expectedStatus) assert.equal((error as { status?: number }).status, expectedStatus);
      if (expectedCode) assert.equal((error as { code?: string }).code, expectedCode);
      return true;
    });
  }
  async function blocked(count: number) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const rows = await pool.query<{ pid: number }>("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%Shilla%' AND query NOT LIKE '%pg_stat_activity%'");
      if (rows.rows.length >= count) return rows.rows.map(row => row.pid);
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    throw new Error("Independent native row-lock waits were not observed");
  }
  async function lockRace(ids: string[], first: () => Promise<unknown>, second: () => Promise<unknown>, scenario: string) {
    const barrier = await pool.connect();
    const settle = (fn: () => Promise<unknown>): Promise<Outcome> => fn().then(value => ({ ok: true, value }), error => ({ ok: false, error }));
    try {
      await barrier.query("BEGIN");
      const pid = (await barrier.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      for (const id of ids) await barrier.query('SELECT "id" FROM "Shilla" WHERE "id"=$1 FOR UPDATE', [id]);
      const a = settle(first); await blocked(1);
      const b = settle(second); const waits = await blocked(2);
      assert.ok(new Set([pid, ...waits]).size >= 3);
      await barrier.query("COMMIT");
      const result = await Promise.all([a, b]);
      concurrency.push({ scenario, independentBackends: new Set([pid, ...waits]).size, observedBlocked: waits.length,
        accepted: result.filter(value => value.ok).length, rejected: result.filter(value => !value.ok).length });
      return result;
    } finally { await barrier.query("ROLLBACK"); barrier.release(); }
  }
  async function joinMember(id: string, member: string) {
    const invite = await createShillaInvite(owner, id);
    return acceptShillaInvite(member, codeOf(invite.path));
  }
  async function complete(outcomes: readonly ["A" | "B" | "TIE", "A" | "B" | "TIE", "A" | "B"]) {
    let night = await command(await create(), "START");
    for (let index = 0; index < 3; index++) {
      const source = night.current?.hostHref?.split("/").at(-1); assert.ok(source);
      await completeCanonicalGame(source, owner, games[index], outcomes[index]);
      night = await command(night, "IMPORT");
      if (index < 2) night = await command(night, "NEXT");
    }
    assert.equal(night.phase, "completed");
    return night;
  }
  async function transactionProbe(fn: (client: PoolClient) => Promise<unknown>) {
    const client = await pool.connect();
    try { await client.query("BEGIN"); await fn(client); }
    finally { await client.query("ROLLBACK"); client.release(); }
  }
  try {
    const initial = await wallet(), initialCredits = await creditCount();
    let groups: Awaited<ReturnType<typeof createShilla>>[] = [];
    await check("five-owned-groups-limit-under-six-concurrent-transactions", async () => {
      const result = await Promise.allSettled(Array.from({ length: 6 }, (_, index) => createShilla(owner,
        { name: `شلّة قبول اصطناعية ${index + 1}`,
          teams: index % 2 ? ["فريق آخر ألف", "فريق آخر باء"] : teams })));
      groups = result.flatMap(value => value.status === "fulfilled" ? [value.value] : []);
      assert.equal(groups.length, 5); assert.equal(result.filter(value => value.status === "rejected").length, 1);
      assert.equal(await db().shilla.count({ where: { ownerId: owner } }), 5);
      const failed = result.find(value => value.status === "rejected") as PromiseRejectedResult;
      assert.equal((failed.reason as { code: string }).code, "GROUP_LIMIT");
    });
    // Any five of six contain at least two groups with matching team names and
    // one with mismatching names; no test-only team mutation is necessary.
    const matching = groups.filter(group => group.teams[0].name === teams[0]);
    const [primary, otherGroup] = matching;
    const capacity = groups.find(group => group.teams[0].name !== teams[0])!;
    const selected = new Set([primary.id, otherGroup.id, capacity.id]);
    const [invites, archived] = groups.filter(group => !selected.has(group.id));
    privateCases.primaryShillaId = primary.id;
    await check("owner-membership-stable-teams-and-outsider-no-private-projection", async () => {
      assert.equal(primary.myRole, "OWNER"); assert.equal(primary.owner, true); assert.equal(primary.members.length, 1);
      assert.deepEqual(primary.teams.map(team => team.name), teams);
      await rejects(() => getShillaView(members[0], primary.id), 404);
      assert.equal((await listMyShillas(members[0])).some(group => group.id === primary.id), false);
      for (const operation of [() => createShillaInvite(members[0], primary.id), () => archiveShilla(members[0], primary.id),
        () => attachShillaNight(members[0], primary.id, randomUUID())]) await rejects(operation, 404);
    });
    let inviteCode = "", inviteRecord = "";
    await check("invite-hash-only-once-and-no-refresh-disclosure", async () => {
      const invite = await createShillaInvite(owner, primary.id); inviteCode = codeOf(invite.path);
      const stored = await db().shillaInvite.findUniqueOrThrow({ where: { tokenHash: digest(inviteCode) } }); inviteRecord = stored.id;
      assert.notEqual(stored.tokenHash, inviteCode); assert.doesNotMatch(JSON.stringify(stored), new RegExp(inviteCode));
      assert.equal(new Date(invite.expiresAt).getTime(), stored.expiresAt.getTime());
      const refreshed = await getShillaView(owner, primary.id);
      assert.doesNotMatch(JSON.stringify(refreshed), new RegExp(inviteCode));
      assert.doesNotMatch(JSON.stringify(await previewShillaInvite(members[0], inviteCode)), /tokenHash|members|ownerId|userId/);
    });
    await check("single-use-invite-two-distinct-registered-members-native-race", async () => {
      const result = await lockRace([primary.id], () => acceptShillaInvite(members[0], inviteCode),
        () => acceptShillaInvite(members[1], inviteCode), "distinct registered members accept one invite");
      assert.equal(result.filter(value => value.ok).length, 1);
      assert.equal(result[0].ok, true); assert.equal(result[1].ok, false);
      assert.equal(await db().shillaMembership.count({ where: { shillaId: primary.id } }), 2);
      assert.ok((await db().shillaInvite.findUniqueOrThrow({ where: { id: inviteRecord } })).consumedAt);
      await rejects(() => acceptShillaInvite(members[2], inviteCode), 409, "INVITE_CLOSED");
      await rejects(() => acceptShillaInvite(members[0], inviteCode), 409, "INVITE_CLOSED");
      assert.equal((await previewShillaInvite(members[0], inviteCode)).shillaId, primary.id);
      await rejects(() => previewShillaInvite(members[2], inviteCode), 404);
    });
    await check("member-private-view-without-authority-and-owner-cannot-leave", async () => {
      const view = await getShillaView(members[0], primary.id);
      assert.equal(view.owner, false); assert.equal(view.myRole, "MEMBER");
      assert.deepEqual(view.activeInvites, []); assert.deepEqual(view.eligibleNights, []);
      for (const operation of [() => createShillaInvite(members[0], primary.id), () => revokeShillaInvite(members[0], primary.id, inviteRecord),
        () => archiveShilla(members[0], primary.id), () => attachShillaNight(members[0], primary.id, randomUUID())]) await rejects(operation, 404);
      await rejects(() => leaveShilla(owner, primary.id), 409, "OWNER_CANNOT_LEAVE");
      assert.doesNotMatch(JSON.stringify(view), /tokenHash|sourceSessionId|sourceDigest|ownerId|userId|resultReceipt/);
      for (const id of [owner, ...members]) assert.equal(JSON.stringify(view).includes(id), false);
    });
    await check("existing-member-does-not-consume-new-invite", async () => {
      const invite = await createShillaInvite(owner, primary.id), code = codeOf(invite.path);
      await rejects(() => acceptShillaInvite(members[0], code), 409, "ALREADY_MEMBER");
      const stored = await db().shillaInvite.findUniqueOrThrow({ where: { tokenHash: digest(code) } });
      assert.equal(stored.consumedAt, null); await acceptShillaInvite(members[2], code);
    });
    await check("revoke-before-accept-and-accept-before-revoke-native-orderings", async () => {
      let invite = await createShillaInvite(owner, primary.id), code = codeOf(invite.path);
      let stored = await db().shillaInvite.findUniqueOrThrow({ where: { tokenHash: digest(code) } });
      let result = await lockRace([primary.id], () => revokeShillaInvite(owner, primary.id, stored.id),
        () => acceptShillaInvite(members[3], code), "REVOKE before ACCEPT");
      assert.equal(result[0].ok, true); assert.equal(result[1].ok, false);
      invite = await createShillaInvite(owner, primary.id); code = codeOf(invite.path);
      stored = await db().shillaInvite.findUniqueOrThrow({ where: { tokenHash: digest(code) } });
      result = await lockRace([primary.id], () => acceptShillaInvite(members[3], code),
        () => revokeShillaInvite(owner, primary.id, stored.id), "ACCEPT before REVOKE");
      assert.equal(result[0].ok, true); assert.equal(result[1].ok, false);
    });
    await check("five-active-invites-bound-under-six-concurrent-creations", async () => {
      const result = await Promise.allSettled(Array.from({ length: 6 }, () => createShillaInvite(owner, invites.id)));
      assert.equal(result.filter(value => value.status === "fulfilled").length, 5);
      assert.equal(result.filter(value => value.status === "rejected").length, 1);
      assert.equal((await getShillaView(owner, invites.id)).activeInvites.length, 5);
    });
    await check("invite-expiry-rechecked-after-native-lock-wait", async () => {
      const invite = await createShillaInvite(owner, primary.id), code = codeOf(invite.path);
      const expiry = new Date(Date.now() + 700);
      await db().shillaInvite.update({ where: { tokenHash: digest(code) }, data: { expiresAt: expiry } });
      const barrier = await pool.connect();
      try {
        await barrier.query("BEGIN");
        await barrier.query('SELECT "id" FROM "Shilla" WHERE "id"=$1 FOR UPDATE', [primary.id]);
        const pending = acceptShillaInvite(members[4], code).then(() => false, error => (error as { code: string }).code === "INVITE_CLOSED");
        await blocked(1); await new Promise(resolve => setTimeout(resolve, Math.max(0, expiry.getTime() - Date.now() + 40)));
        await barrier.query("COMMIT"); assert.equal(await pending, true);
      } finally { await barrier.query("ROLLBACK"); barrier.release(); }
      await rejects(() => previewShillaInvite(members[4], code), 404);
    });
    await check("queued-invite-creation-uses-post-lock-clock-for-expiry-and-active-count", async () => {
      const expiry = new Date(Date.now() + 700);
      await db().shillaInvite.updateMany({ where: { shillaId: invites.id }, data: { expiresAt: expiry } });
      const barrier = await pool.connect();
      try {
        await barrier.query("BEGIN");
        await barrier.query('SELECT "id" FROM "Shilla" WHERE "id"=$1 FOR UPDATE', [invites.id]);
        const pending = createShillaInvite(owner, invites.id).then(value => ({ ok: true as const, value }), () => ({ ok: false as const }));
        await blocked(1); await new Promise(resolve => setTimeout(resolve, Math.max(0, expiry.getTime() - Date.now() + 40)));
        const releasedAt = Date.now(); await barrier.query("COMMIT");
        const result = await pending; assert.equal(result.ok, true); if (!result.ok) return;
        const stored = await db().shillaInvite.findUniqueOrThrow({ where: { tokenHash: digest(codeOf(result.value.path)) } });
        assert.ok(stored.expiresAt.getTime() >= releasedAt + 7 * 86400_000);
        assert.equal(new Date(result.value.expiresAt).getTime(), stored.expiresAt.getTime());
      } finally { await barrier.query("ROLLBACK"); barrier.release(); }
    });
    await check("twentieth-member-capacity-under-two-independent-accepts", async () => {
      for (const member of members.slice(0, 18)) await joinMember(capacity.id, member);
      const a = codeOf((await createShillaInvite(owner, capacity.id)).path), b = codeOf((await createShillaInvite(owner, capacity.id)).path);
      const result = await lockRace([capacity.id], () => acceptShillaInvite(members[18], a),
        () => acceptShillaInvite(members[19], b), "two accepts contest twentieth total member");
      assert.equal(result.filter(value => value.ok).length, 1);
      assert.equal(await db().shillaMembership.count({ where: { shillaId: capacity.id } }), 20);
      assert.equal((await db().shillaInvite.findUniqueOrThrow({ where: { tokenHash: digest(b) } })).consumedAt, null);
      await rejects(() => createShillaInvite(owner, capacity.id), 409, "FULL");
    });
    await check("member-leave-removes-access-without-deleting-group-history", async () => {
      const before = (await getShillaView(owner, primary.id)).members.length;
      await leaveShilla(members[2], primary.id);
      await rejects(() => getShillaView(members[2], primary.id), 404);
      assert.equal((await getShillaView(owner, primary.id)).members.length, before - 1);
      assert.equal(await db().shilla.count({ where: { ownerId: owner } }), 5);
    });
    await check("archive-before-accept-and-accept-before-archive-native-orderings", async () => {
      let invite = codeOf((await createShillaInvite(owner, archived.id)).path);
      let result = await lockRace([archived.id], () => acceptShillaInvite(members[5], invite),
        () => archiveShilla(owner, archived.id), "ACCEPT before ARCHIVE");
      assert.ok(result.every(value => value.ok));
      assert.equal((await getShillaView(members[5], archived.id)).status, "archived");
      await rejects(() => createShillaInvite(owner, archived.id), 409, "ARCHIVED");
      invite = codeOf((await createShillaInvite(owner, invites.id)).path);
      result = await lockRace([invites.id], () => archiveShilla(owner, invites.id),
        () => acceptShillaInvite(members[6], invite), "ARCHIVE before ACCEPT");
      assert.equal(result[0].ok, true); assert.equal(result[1].ok, false);
      await rejects(() => previewShillaInvite(members[6], invite), 404);
    });
    await check("group-planning-memberships-invites-archive-and-leave-credit-neutral", async () => {
      assert.equal(await wallet(), initial); assert.equal(await creditCount(), initialCredits);
    });
    let winner!: NightView, tied!: NightView, second!: NightView;
    await check("three-canonical-original-games-winner-and-three-start-debits-only", async () => {
      winner = await complete(["A", "A", "A"]);
      assert.deepEqual(winner.teams.map(team => winner.totals[team.id]), [9, 6]);
      assert.equal(await wallet(), initial - 3); assert.equal(await creditCount(), initialCredits + 3);
      privateCases.winnerNightId = winner.id;
    });
    await check("real-canonical-tie-and-second-night-without-forged-game-results", async () => {
      tied = await complete(["A", "TIE", "B"]); second = await complete(["B", "B", "B"]);
      assert.deepEqual(tied.teams.map(team => tied.totals[team.id]), [8, 8]);
      assert.deepEqual(second.teams.map(team => second.totals[team.id]), [6, 9]);
      assert.equal(tied.winnerIds.length, 2); assert.equal(await wallet(), initial - 9);
      assert.equal(await creditCount(), initialCredits + 9);
      privateCases.tieNightId = tied.id; privateCases.secondNightId = second.id;
    });
    await check("reject-incomplete-foreign-owner-mismatched-teams-and-client-authority-fields", async () => {
      await rejects(async () => attachShillaNight(owner, primary.id, (await create()).id), 409, "NIGHT_NOT_ELIGIBLE");
      await rejects(async () => attachShillaNight(owner, primary.id, (await create(members[22])).id), 404);
      await rejects(() => attachShillaNight(owner, capacity.id, winner.id), 409, "NIGHT_NOT_ELIGIBLE");
      // Real accepted DB receipts, tested against different stable team names; no result writes.
      const stable = await db().shillaTeam.findMany({ where: { shillaId: primary.id }, orderBy: { position: "asc" } });
      const accepted = await db().nightSession.findUniqueOrThrow({ where: { id: winner.id }, include: { games: { orderBy: { position: "asc" } } } });
      assert.throws(() => completedSnapshot(accepted, stable.map(team => ({ ...team, name: `${team.name} مختلف` }))));
      for (const extra of ["points", "winnerId", "ownerId", "sourceSessionId", "snapshot"]) assert.equal(attachNightSchema.safeParse({ nightId: winner.id, [extra]: "forged" }).success, false);
    });
    await check("accepted-receipt-sql-immutable-and-validator-rejects-corrupted-native-record-clones", async () => {
      const before = await db().nightGame.findMany({ where: { nightId: winner.id }, orderBy: { position: "asc" } });
      const stable = await db().shillaTeam.findMany({ where: { shillaId: primary.id }, orderBy: { position: "asc" } });
      const accepted = await db().nightSession.findUniqueOrThrow({ where: { id: winner.id }, include: { games: { orderBy: { position: "asc" } } } });
      for (const mutation of ["missing", "contradictory", "source-version"] as const) {
        // The pre-existing accepted NightGame trigger rejects SQL corruption too.
        await transactionProbe(async client => {
          const sql = mutation === "missing" ? 'UPDATE "NightGame" SET "resultReceipt"=NULL WHERE "id"=$1' :
            mutation === "source-version" ? 'UPDATE "NightGame" SET "sourceVersion"="sourceVersion"+1 WHERE "id"=$1' :
              'UPDATE "NightGame" SET "resultReceipt"=jsonb_set("resultReceipt",\'{digest}\',\'"incorrect"\') WHERE "id"=$1';
          await assert.rejects(() => client.query(sql, [before[0].id]), error => {
            assert.equal((error as { code: string }).code, "P0001"); return true;
          });
        });
        // Defense-in-depth validation of a corrupted projection, never persisted.
        const corrupt = structuredClone(accepted);
        if (mutation === "missing") corrupt.games[0].resultReceipt = null;
        if (mutation === "contradictory") (corrupt.games[0].resultReceipt as { digest: string }).digest = "incorrect";
        if (mutation === "source-version") corrupt.games[0].sourceVersion = (corrupt.games[0].sourceVersion ?? 0) + 1;
        assert.throws(() => completedSnapshot(corrupt, stable));
      }
      assert.deepEqual(await db().nightGame.findMany({ where: { nightId: winner.id }, orderBy: { position: "asc" } }), before);
      assert.equal(await db().shillaNight.count({ where: { nightId: winner.id } }), 0);
    });
    await check("duplicate-attach-native-orderings-one-snapshot-no-extra-debit", async () => {
      const result = await lockRace([primary.id], () => attachShillaNight(owner, primary.id, winner.id),
        () => attachShillaNight(owner, primary.id, winner.id), "duplicate same-group ATTACH");
      assert.ok(result.every(value => value.ok));
      assert.equal(await db().shillaNight.count({ where: { nightId: winner.id } }), 1);
      await attachShillaNight(owner, primary.id, winner.id);
      const view = await getShillaView(owner, primary.id);
      assert.equal(view.nights.length, 1); assert.equal(view.leaderboard[0].wins, 1);
      assert.equal(await wallet(), initial - 9); assert.equal(await creditCount(), initialCredits + 9);
    });
    await check("tie-and-multiple-nights-correct-competition-ranking-and-accumulated-points", async () => {
      await attachShillaNight(owner, primary.id, tied.id); await attachShillaNight(owner, primary.id, second.id);
      const view = await getShillaView(owner, primary.id);
      assert.equal(view.nights.length, 3);
      assert.deepEqual(view.leaderboard.map(row => [row.rank, row.wins, row.points, row.played]), [[1, 2, 23, 3], [1, 2, 23, 3]]);
      assert.equal(view.nights.find(row => row.teams.every(team => team.points === 8))?.teams.filter(team => team.champion).length, 2);
      const member = await getShillaView(members[0], primary.id);
      assert.deepEqual(member.leaderboard, view.leaderboard);
      assert.doesNotMatch(JSON.stringify(member), /sourceSessionId|sourceDigest|resultReceipt|tokenHash|ownerId|userId/);
      for (const night of [winner, tied, second]) assert.equal(JSON.stringify(member).includes(night.id), false);
    });
    let cross!: NightView;
    await check("cross-group-same-night-unique-under-independent-native-transactions", async () => {
      cross = await complete(["A", "A", "A"]);
      const result = await lockRace([primary.id, otherGroup.id], () => attachShillaNight(owner, primary.id, cross.id),
        () => attachShillaNight(owner, otherGroup.id, cross.id), "cross-group ATTACH same Night");
      assert.equal(result.filter(value => value.ok).length, 1); assert.equal(result.filter(value => !value.ok).length, 1);
      assert.equal(await db().shillaNight.count({ where: { nightId: cross.id } }), 1);
      const saved = await db().shillaNight.findUniqueOrThrow({ where: { nightId: cross.id } });
      await rejects(() => attachShillaNight(owner, saved.shillaId === primary.id ? otherGroup.id : primary.id, cross.id), 409, "ALREADY_LINKED");
      assert.equal(await wallet(), initial - 12); assert.equal(await creditCount(), initialCredits + 12);
    });
    await check("immutable-snapshot-update-and-delete-rejected-with-rollback-preservation", async () => {
      const saved = await db().shillaNight.findUniqueOrThrow({ where: { nightId: winner.id } });
      for (const sql of ['UPDATE "ShillaNight" SET "sourceDigest"=\'altered\' WHERE "id"=$1', 'DELETE FROM "ShillaNight" WHERE "id"=$1']) {
        await transactionProbe(async client => {
          await assert.rejects(() => client.query(sql, [saved.id]), error => {
            assert.equal((error as { code: string }).code, "P0001"); return true;
          });
        });
        assert.deepEqual(await db().shillaNight.findUniqueOrThrow({ where: { id: saved.id } }), saved);
      }
    });
    await check("archived-group-rejects-attachment-and-preserves-readable-audit-history", async () => {
      await archiveShilla(owner, primary.id);
      const view = await getShillaView(members[0], primary.id);
      assert.equal(view.status, "archived"); assert.ok(view.nights.length >= 3);
      await rejects(() => attachShillaNight(owner, primary.id, winner.id), 409, "ARCHIVED");
      await leaveShilla(members[0], primary.id); await rejects(() => getShillaView(members[0], primary.id), 404);
    });
    await check("all-shillatak-operations-zero-additional-credit-debits", async () => {
      assert.equal(await wallet(), initial - 12); assert.equal(await creditCount(), initialCredits + 12);
      const entries = await db().gameCredit.findMany({ where: { userId: owner, delta: { lt: 0 } } });
      assert.equal(entries.length, 12); assert.ok(entries.every(entry => entry.delta === -1 && entry.idempotencyKey.startsWith("game-start:")));
    });
    writeFileSync(join(evidence, "cases.private.json"), JSON.stringify(privateCases), { flag: "wx", mode: 0o600 });
    status = "PASSED";
  } catch (error) {
    const failure = error as { constructor?: { name?: string }; code?: unknown };
    failureClass = /^[A-Za-z]+$/.test(failure.constructor?.name ?? "") ? failure.constructor!.name! : "Error";
    failureCode = typeof failure.code === "string" && /^[A-Z0-9_]+$/.test(failure.code) ? failure.code : null;
  } finally {
    await pool.end(); await db().$disconnect();
    const receipt = { schemaVersion: 1, sourceHead, sourceDirty, syntheticOnly: true, nativePostgresMajor: 17,
      mocks: false, canonicalRoundsPerNight: [5, 7, 5], status, passed: checks.filter(check => check.passed).length,
      failed: checks.filter(check => !check.passed).length, failureStep: status === "PASSED" ? null : currentStep,
      failureClass, failureCode, checks, concurrency, finishedAt: new Date().toISOString() };
    writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ status, passed: receipt.passed, failed: receipt.failed, failureStep: receipt.failureStep, failureClass, failureCode }));
    if (status !== "PASSED") process.exitCode = 1;
  }
}
main().catch(() => { console.error("Beta native acceptance failed before sanitized receipt; private values withheld."); process.exitCode = 1; });
