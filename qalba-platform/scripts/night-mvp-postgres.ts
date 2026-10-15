/** Native PostgreSQL acceptance; no in-memory substitutes or fabricated results.
 * First provision a fresh synthetic DB, apply migrations, then run fixtures --seed.
 * Invoke with the same explicit environment as night-mvp-fixtures.ts.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { db } from "../src/lib/db";
import { createNightSession, getNightView, applyNightCommand } from "../src/lib/night/service";
import { verifyNightOutcome, type NightSource } from "../src/lib/night/adapters";
import type { NightCreateInput, NightTeamMapping, NightView } from "../src/lib/night/types";
import { completeCanonicalGame } from "./night-mvp-engines";
import { isolatedEnvironment, loadFixture } from "./night-mvp-fixtures";
import { applyRankedCommand, createRankedSession, getRankedView } from "../src/lib/games/ranked/service";
import { applySurveyCommand, getSurveyView } from "../src/lib/games/survey-battle/service";

async function main() {
const { output } = isolatedEnvironment();
assert.equal(process.env.ENABLE_NIGHT_OF_QUDDAM, "true", "Local Night acceptance flag must be explicitly enabled");
const fixture = await loadFixture();
const evidence = join(output, process.env.NIGHT_MVP_POSTGRES_RUN ?? "postgres");
mkdirSync(evidence, { mode: 0o700 });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const games: NightCreateInput["games"] = ["top-list", "ordering-challenge", "survey-show"];
const teams: [string, string] = ["فريق قبول أول", "فريق قبول ثان"];
const checks: { name: string; passed: boolean; code?: string }[] = [];
const concurrency: { scenario: string; backendIds: number[]; blockedNativeSessions: number; oneEffect: boolean; sourceRematchAccepted?: boolean }[] = [];
const played: { game: string; status: string; rounds: number }[] = [];
let currentStep = "initialization";
async function check(name: string, fn: () => Promise<unknown>) {
  currentStep = name;
  try { await fn(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, code: typeof error === "object" && error !== null && "code" in error ? String(error.code).slice(0, 80) : "ASSERTION_FAILED" }); throw error; }
}
async function rejects(fn: () => Promise<unknown>, code?: string) {
  await assert.rejects(fn, error => { if (code) assert.equal((error as { code?: string }).code, code); return true; });
}
const create = (input: Partial<NightCreateInput> = {}, ownerId = fixture.ownerId) => createNightSession(ownerId, { key: randomUUID(), games, teams, ...input });
const command = (night: NightView, op: "START" | "IMPORT" | "NEXT" | "END", key: string = randomUUID(), expectedVersion = night.version) => applyNightCommand(fixture.ownerId, night.id, { key, expectedVersion, op });
const wallet = async () => (await db().creditWallet.findUniqueOrThrow({ where: { userId: fixture.ownerId } })).balance;
const sourceId = (night: NightView) => { const id = night.current?.hostHref?.split("/").at(-1); assert.ok(id); return id; };
const noSecrets = (night: NightView) => assert.doesNotMatch(JSON.stringify(night), /"(?:snapshot|useIds|answers|alternativeAnswers|correctPosition|correctOrder|tokenHash|passwordHash|ownerToken)"/);
async function source(id: string): Promise<NightSource> {
  return db().gameSession.findUniqueOrThrow({ where: { id }, include: {
    gameType: { select: { slug: true } }, teams: { orderBy: { position: "asc" } },
    commands: { orderBy: { stateVersion: "asc" }, select: { type: true, stateVersion: true } },
    rankedUses: { orderBy: { roundIndex: "asc" }, select: { id: true, matchNumber: true, roundIndex: true, gameRound: { select: { endedAt: true } } } },
    orderingUses: { orderBy: { roundIndex: "asc" }, select: { id: true, matchNumber: true, roundIndex: true, endedAt: true } },
    surveyQuestionUses: { orderBy: { roundNumber: "asc" }, select: { id: true, matchNumber: true, roundNumber: true } },
  } });
}
async function waitForBlocked(nightId: string, count: number, table = "NightSession") {
  assert.ok(["NightSession", "GameSession"].includes(table));
  for (let attempt = 0; attempt < 100; attempt++) {
    const waiting = await pool.query<{ pid: number }>("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%'||$2||'%' AND query NOT LIKE '%pg_stat_activity%' AND query LIKE '%'||$1||'%'", [nightId, table]);
    // Prisma parameterizes IDs, so inspect blocked queries without matching literals.
    const actual = waiting.rows.length ? waiting : await pool.query<{ pid: number }>("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%'||$1||'%' AND query NOT LIKE '%pg_stat_activity%'", [table]);
    if (actual.rows.length >= count) return actual.rows.map(row => row.pid);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error("Native lock contention not observed");
}
async function serializedRace(night: NightView, first: () => Promise<NightView>, second: () => Promise<NightView>, scenario: string) {
  const barrier = await pool.connect();
  try {
    await barrier.query("BEGIN");
    const own = (await barrier.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    await barrier.query('SELECT "id" FROM "NightSession" WHERE "id"=$1 FOR UPDATE', [night.id]);
    // Catch immediately: a rejection before the barrier releases must not become
    // an unhandled rejection or disappear from the observed concurrency outcome.
    const a = first().then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error }));
    await waitForBlocked(night.id, 1);
    const b = second().then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error }));
    const waiting = await waitForBlocked(night.id, 2);
    const backendIds = [...new Set([own, ...waiting])];
    assert.ok(backendIds.length >= 3, "Two independent native command backends plus a lock barrier required");
    await barrier.query("COMMIT");
    const outcomes = await Promise.all([a, b]);
    assert.equal((await getNightView(fixture.ownerId, night.id)).version, night.version + 1);
    concurrency.push({ scenario, backendIds, blockedNativeSessions: waiting.length, oneEffect: true });
    return outcomes;
  } catch (error) { await barrier.query("ROLLBACK"); throw error; }
  finally { barrier.release(); }
}
let status = "FAILED";
try {
  await check("feature-disabled-by-default-rejects-service-access", async () => {
    delete process.env.ENABLE_NIGHT_OF_QUDDAM;
    try { await rejects(() => create(), "FEATURE_DISABLED"); }
    finally { process.env.ENABLE_NIGHT_OF_QUDDAM = "true"; }
  });
  await check("reject-nonofficial-and-unintegrated-games", async () => {
    for (const game of ["legacy-party", "fastest-mind", "lightning-quiz"]) await rejects(() => create({ games: [game, ...games.slice(1)] as NightCreateInput["games"] }));
  });
  await check("reject-duplicate-or-fewer-than-three-games", async () => {
    await rejects(() => create({ games: [games[0], games[0], games[2]] }));
    await rejects(() => create({ games: games.slice(0, 2) }));
  });
  await check("reject-invalid-or-duplicate-team-identities", async () => {
    for (const names of [["الفريق", "الفريق"], ["", "الفريق"], ["الفريق\nالأول", "الفريق الثاني"], ["فريق واحد"], ["فريق أول", "فريق ثان", "فريق ثالث"]]) await rejects(() => create({ teams: names as [string, string] }));
  });
  await check("service-rejects-supplied-team-ids-results-or-source-id", async () => {
    for (const extra of [{ results: [{ points: { forged: 99 } }] }, { totals: { forged: 99 } }, { sourceSessionId: randomUUID() }]) await rejects(() => createNightSession(fixture.ownerId, { key: randomUUID(), games, teams, ...extra } as NightCreateInput), "INVALID_INPUT");
    await rejects(() => createNightSession(fixture.ownerId, { key: randomUUID(), games, teams: [{ id: "forged", name: "فريق أول" }, { id: "forged2", name: "فريق ثان" }] } as unknown as NightCreateInput));
  });
  const before = await wallet();
  const debitBefore = await db().gameCredit.count({ where: { userId: fixture.ownerId, delta: -1 } });
  const createKey = randomUUID();
  let night = await create({ key: createKey });
  await check("create-three-game-night-replay-exactly-once-with-no-credit-debit", async () => {
    const replay = await create({ key: createKey });
    assert.equal(replay.id, night.id); assert.equal(replay.version, night.version); assert.equal(await wallet(), before);
    assert.equal(await db().nightSession.count({ where: { ownerId: fixture.ownerId, createKey } }), 1);
  });
  await check("create-key-cannot-be-reused-for-different-games-or-names", async () => {
    await rejects(() => create({ key: createKey, games: [...games].reverse() }), "COMMAND_KEY_REUSED");
    await rejects(() => create({ key: createKey, teams: ["فريق مختلف", teams[1]] }), "COMMAND_KEY_REUSED");
  });
  await check("other-owner-cannot-read-or-command-night", async () => {
    await rejects(() => getNightView(fixture.otherOwnerId, night.id), "NOT_FOUND");
    await rejects(() => applyNightCommand(fixture.otherOwnerId, night.id, { key: randomUUID(), expectedVersion: night.version, op: "START" }), "NOT_FOUND");
  });
  await check("concurrent-identical-start-creates-one-child-and-no-credit-debit", async () => {
    const key = randomUUID();
    const start = () => command(night, "START", key);
    const outcomes = await serializedRace(night, start, start, "same-key START");
    assert.ok(outcomes.every(item => item.ok));
    night = await getNightView(fixture.ownerId, night.id);
    assert.equal(night.phase, "playing");
    assert.equal(await db().nightGame.count({ where: { nightId: night.id, sourceSessionId: { not: null } } }), 1);
    assert.equal(await db().nightCommand.count({ where: { nightId: night.id, key } }), 1);
    assert.equal(await wallet(), before);
  });
  await check("stale-command-and-key-reuse-rejected", async () => {
    await rejects(() => command(night, "END", randomUUID(), 0), "STALE_NIGHT_STATE");
    const start = await db().nightCommand.findFirstOrThrow({ where: { nightId: night.id, type: "START" } });
    await rejects(() => command(night, "END", start.key), "COMMAND_KEY_REUSED");
  });
  await check("cannot-advance-or-import-an-incomplete-canonical-game", async () => {
    await rejects(() => command(night, "NEXT")); await rejects(() => command(night, "IMPORT"), "SOURCE_NOT_VERIFIED");
    assert.equal((await getNightView(fixture.ownerId, night.id)).results.length, 0);
  });
  const importedDigests: string[] = [];
  for (const [index, game] of games.entries()) {
    await check(`canonical-${game}-full-match-import-and-exact-normalized-points`, async () => {
      const id = sourceId(night);
      played.push(await completeCanonicalGame(id, fixture.ownerId, game));
      const ready = await getNightView(fixture.ownerId, night.id); assert.equal(ready.importReady, true);
      if (index === 0) {
        const key = randomUUID(), importResult = () => command(ready, "IMPORT", key);
        const outcomes = await serializedRace(ready, importResult, importResult, "same-key IMPORT");
        assert.ok(outcomes.every(item => item.ok));
      } else await command(ready, "IMPORT");
      night = await getNightView(fixture.ownerId, night.id);
      assert.equal(night.results.length, index + 1);
      assert.deepEqual(night.teams.map(t => night.totals[t.id]), [(index + 1) * 3, (index + 1) * 2]);
      assert.deepEqual(night.winnerIds, index === 2 ? [night.teams[0].id] : []);
      const gameRow = await db().nightGame.findUniqueOrThrow({ where: { nightId_position: { nightId: night.id, position: index } } });
      assert.ok(gameRow.resultDigest); importedDigests.push(gameRow.resultDigest);
      const sameState = await getNightView(fixture.ownerId, night.id); assert.deepEqual(sameState, night);
      assert.equal(await wallet(), before - index - 1);
      noSecrets(night);
    });
    await check(`duplicate-${game}-import-cannot-change-accepted-result`, async () => {
      const prior = night;
      try { await command(night, "IMPORT"); } catch (error) { assert.ok(["SOURCE_NOT_VERIFIED", "INVALID_PHASE", "RESULT_ALREADY_ACCEPTED"].includes((error as { code: string }).code)); }
      night = await getNightView(fixture.ownerId, night.id);
      assert.deepEqual(night.results, prior.results); assert.deepEqual(night.totals, prior.totals);
      assert.deepEqual((await db().nightGame.findMany({ where: { nightId: night.id, resultDigest: { not: null } }, orderBy: { position: "asc" } })).map(row => row.resultDigest), importedDigests);
    });
    if (index < 2) await check(`next-${index + 1}-is-ordered-idempotent-and-free`, async () => {
      const key = randomUUID(), version = night.version, credit = await wallet();
      const next = await command(night, "NEXT", key);
      const replay = await command(night, "NEXT", key, version);
      assert.equal(next.id, night.id); assert.equal(replay.version, next.version);
      assert.deepEqual(next.teams, night.teams); assert.equal(next.currentIndex, index + 1); assert.equal(await wallet(), credit);
      assert.equal(await db().nightGame.count({ where: { nightId: night.id, sourceSessionId: { not: null } } }), index + 2);
      night = next;
    });
  }
  await check("completed-night-has-real-champion-and-three-immutable-results", async () => {
    assert.equal(night.phase, "completed"); assert.equal(night.results.length, 3);
    assert.equal(await db().gameCredit.count({ where: { userId: fixture.ownerId, delta: -1 } }), debitBefore + 3);
    const records = await db().nightGame.findMany({ where: { nightId: night.id }, orderBy: { position: "asc" } });
    const mapping = records[0].teamMapping as NightTeamMapping[];
    const canonical = await source(records[0].sourceSessionId!);
    assert.equal(verifyNightOutcome(fixture.ownerId, "top-list", mapping, canonical).digest, records[0].resultDigest);
    assert.throws(() => verifyNightOutcome(fixture.otherOwnerId, "top-list", mapping, canonical));
  });
  await check("native-database-triggers-prevent-accepted-receipt-identity-and-audit-rewrites", async () => {
    const game = await db().nightGame.findUniqueOrThrow({ where: { nightId_position: { nightId: night.id, position: 0 } } });
    const audit = await db().nightCommand.findFirstOrThrow({ where: { nightId: night.id } });
    const attempts: [string, string][] = [
      ['UPDATE "NightGame" SET "resultReceipt"=\'{}\'::jsonb WHERE "id"=$1', game.id],
      ['UPDATE "NightGame" SET "resultDigest"=repeat(\'0\',64) WHERE "id"=$1', game.id],
      ['UPDATE "NightGame" SET "teamMapping"=\'[]\'::jsonb WHERE "id"=$1', game.id],
      ['UPDATE "NightGame" SET "sourceSessionId"=NULL WHERE "id"=$1', game.id],
      ['DELETE FROM "NightGame" WHERE "id"=$1', game.id],
      ['UPDATE "NightCommand" SET "type"=\'END\' WHERE "id"=$1', audit.id],
      ['DELETE FROM "NightCommand" WHERE "id"=$1', audit.id],
    ];
    for (const [query, id] of attempts) {
      const connection = await pool.connect();
      try {
        await connection.query("BEGIN");
        // Every negative attempt is rolled back, including unexpected success.
        await assert.rejects(() => connection.query(query, [id]), error => { assert.equal((error as { code?: string }).code, "P0001"); return true; });
      } finally { await connection.query("ROLLBACK"); connection.release(); }
    }
    assert.deepEqual(await db().nightGame.findUniqueOrThrow({ where: { id: game.id } }), game);
    assert.deepEqual(await db().nightCommand.findUniqueOrThrow({ where: { id: audit.id } }), audit);
  });
  await check("a-different-real-session-cannot-replace-the-bound-result", async () => {
    const foreign = await createRankedSession(fixture.otherOwnerId, teams);
    played.push(await completeCanonicalGame(foreign.id, fixture.otherOwnerId, "top-list"));
    const record = await db().nightGame.findUniqueOrThrow({ where: { nightId_position: { nightId: night.id, position: 0 } } });
    const actualForeign = await source(foreign.id);
    assert.throws(() => verifyNightOutcome(fixture.ownerId, "top-list", record.teamMapping as NightTeamMapping[], actualForeign));
  });
  // A second real series proves partial + final ties with canonical scores:
  // ranked tie gives3/3, ordering A gives3/2, survey B gives2/3 =>8/8.
  await check("partial-and-final-ties-use-competition-ranking-with-multiple-champions", async () => {
    let tied = await command(await create(), "START");
    for (const [index, outcome] of (["TIE", "A", "B"] as const).entries()) {
      played.push(await completeCanonicalGame(sourceId(tied), fixture.ownerId, games[index], outcome));
      tied = await command(await getNightView(fixture.ownerId, tied.id), "IMPORT");
      if (index === 0) assert.deepEqual(tied.teams.map(t => tied.totals[t.id]), [3, 3]);
      if (index < 2) tied = await command(tied, "NEXT");
    }
    assert.equal(tied.phase, "completed"); assert.deepEqual(tied.teams.map(t => tied.totals[t.id]), [8, 8]);
    assert.deepEqual([...tied.winnerIds].sort(), tied.teams.map(t => t.id).sort());
  });
  await check("shortened-survey-completion-is-not-importable", async () => {
    let ended = await command(await create({ games: ["survey-show", "top-list", "ordering-challenge"] }), "START");
    const id = sourceId(ended), actor = { kind: "HOST" as const, id: fixture.ownerId };
    for (const type of ["START", "END_GAME", "COMPLETE"] as const) await applySurveyCommand(id, fixture.ownerId, randomUUID(), (await getSurveyView(id, actor)).version, { type });
    ended = await getNightView(fixture.ownerId, ended.id);
    assert.equal(ended.importReady, false); await rejects(() => command(ended, "IMPORT"), "SOURCE_NOT_VERIFIED");
    assert.equal(ended.results.length, 0); assert.deepEqual(ended.winnerIds, []);
  });
  for (const firstOp of ["START", "END"] as const) await check(`native-${firstOp.toLowerCase()}-first-ordering-serializes-against-conflicting-command`, async () => {
    const original = await create(), secondOp = firstOp === "START" ? "END" : "START", credit = await wallet();
    const outcomes = await serializedRace(original, () => command(original, firstOp), () => command(original, secondOp), `${firstOp} before ${secondOp}`);
    assert.equal(outcomes[0].ok, true); assert.equal(outcomes[1].ok, false);
    const value = await getNightView(fixture.ownerId, original.id);
    assert.equal(value.phase, firstOp === "START" ? "playing" : "ended");
    assert.equal(value.version, original.version + 1); assert.deepEqual(value.winnerIds, []); assert.equal(await wallet(), credit);
  });
  for (const firstOp of ["IMPORT", "REMATCH"] as const) await check(`native-${firstOp.toLowerCase()}-first-preserves-source-result-integrity`, async () => {
    let contested = await command(await create(), "START");
    const id = sourceId(contested);
    played.push(await completeCanonicalGame(id, fixture.ownerId, "top-list"));
    contested = await getNightView(fixture.ownerId, contested.id);
    const credit = await wallet(), importKey = randomUUID();
    const rematchVersion = (await getRankedView(id, { kind: "HOST", id: fixture.ownerId })).version;
    const importing = () => command(contested, "IMPORT", importKey);
    const rematching = () => applyRankedCommand(id, fixture.ownerId, randomUUID(), rematchVersion, { type: "REMATCH" });
    const barrier = await pool.connect();
    try {
      await barrier.query("BEGIN");
      const barrierId = (await barrier.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      await barrier.query('SELECT "id" FROM "GameSession" WHERE "id"=$1 FOR UPDATE', [id]);
      const settle = (fn: () => Promise<unknown>) => fn().then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error }));
      const a = settle(firstOp === "IMPORT" ? importing : rematching);
      await waitForBlocked(id, 1, "GameSession");
      const b = settle(firstOp === "IMPORT" ? rematching : importing);
      const waiting = await waitForBlocked(id, 2, "GameSession");
      const backendIds = [...new Set([barrierId, ...waiting])];
      assert.ok(backendIds.length >= 3);
      await barrier.query("COMMIT");
      const [first, second] = await Promise.all([a, b]);
      assert.equal(first.ok, true);
      if (firstOp === "IMPORT") assert.equal(second.ok, true);
      else { assert.equal(second.ok, false); if (!second.ok) assert.equal((second.error as { code?: string }).code, "SOURCE_NOT_VERIFIED"); }
      const final = await getNightView(fixture.ownerId, contested.id);
      assert.equal((await getRankedView(id, { kind: "HOST", id: fixture.ownerId })).matchNumber, 2);
      assert.equal(final.results.length, firstOp === "IMPORT" ? 1 : 0);
      assert.deepEqual(final.teams.map(t => final.totals[t.id]), firstOp === "IMPORT" ? [3, 2] : [0, 0]);
      assert.deepEqual(final.winnerIds, []);
      assert.equal(await wallet(), credit, "Canonical free rematch and Night import must not add a debit");
      const record = await db().nightGame.findUniqueOrThrow({ where: { nightId_position: { nightId: contested.id, position: 0 } } });
      if (firstOp === "IMPORT") {
        assert.ok(record.resultDigest);
        const immutable = record.resultDigest;
        await rejects(() => importing(), "SOURCE_NOT_VERIFIED");
        assert.equal((await db().nightGame.findUniqueOrThrow({ where: { id: record.id } })).resultDigest, immutable);
        assert.deepEqual((await getNightView(fixture.ownerId, contested.id)).totals, final.totals);
      } else assert.equal(record.resultDigest, null);
      concurrency.push({ scenario: `${firstOp} before ${firstOp === "IMPORT" ? "REMATCH" : "IMPORT"}`, backendIds, blockedNativeSessions: waiting.length, oneEffect: true, sourceRematchAccepted: true });
    } catch (error) { await barrier.query("ROLLBACK"); throw error; }
    finally { barrier.release(); }
  });
  await check("ending-unfinished-night-preserves-results-without-false-champion", async () => {
    let ended = await command(await create(), "START");
    played.push(await completeCanonicalGame(sourceId(ended), fixture.ownerId, "top-list"));
    ended = await command(await getNightView(fixture.ownerId, ended.id), "IMPORT");
    const prior = ended.results, credit = await wallet(); ended = await command(ended, "END");
    assert.equal(ended.phase, "ended"); assert.deepEqual(ended.results, prior); assert.deepEqual(ended.winnerIds, []); assert.equal(await wallet(), credit);
  });
  status = "PASSED";
} catch { /* Detailed exceptions may contain private DB credentials or answer snapshots. */ }
finally {
  const receipt = { schemaVersion: 1, sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), status, nativePostgres: true, syntheticOnly: true, mocks: false, checks, concurrency, canonicalGames: played, passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length || (status === "FAILED" ? 1 : 0), failureStep: status === "FAILED" ? currentStep : null };
  writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2), { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ status, passed: receipt.passed, failed: receipt.failed, failureStep: receipt.failureStep }));
  await pool.end(); await db().$disconnect();
  process.exitCode = status === "PASSED" ? 0 : 1;
}
}
main().catch(() => { console.error("Native Night acceptance initialization failed; private values withheld."); process.exitCode = 1; }).finally(() => db().$disconnect());
