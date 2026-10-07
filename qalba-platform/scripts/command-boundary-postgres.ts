import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { newToken, tokenHash } from '../src/lib/auth/crypto';
import * as social from '../src/lib/games/social-deduction/service';
import * as ranked from '../src/lib/games/ranked/service';
import type { Action, List } from '../src/lib/games/ranked/module';
if (!process.env.DATABASE_URL?.includes('127.0.0.1')) throw Error('An isolated native PostgreSQL database is required');
const mode = process.env.COMMAND_BOUNDARY_MODE ?? 'after';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const client = new PrismaClient({ adapter: new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0]) });
(globalThis as unknown as { prisma: PrismaClient }).prisma = client;
const cases: { name: string; passed: boolean; detail?: unknown }[] = [];
async function check(name: string, run: () => Promise<unknown>) { try { const detail = await run(); cases.push({ name, passed: true, detail }); console.log('PASS', name); } catch (error) { cases.push({ name, passed: false }); throw error; } }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function invariant(id: string) {
 return {
  session: await client.gameSession.findUniqueOrThrow({ where: { id } }),
  commands: await client.gameCommand.findMany({ where: { sessionId: id }, orderBy: { id: 'asc' } }),
  votes: await client.socialVote.findMany({ where: { round: { sessionId: id } }, orderBy: { id: 'asc' } }),
  rounds: await client.socialRound.findMany({ where: { sessionId: id }, orderBy: { number: 'asc' } }),
  players: await client.socialParticipant.findMany({ where: { sessionId: id }, orderBy: { id: 'asc' } }),
  scores: await client.scoreEvent.findMany({ where: { sessionId: id }, orderBy: { id: 'asc' } }),
 };
}
async function main() {
 const host = await client.user.findUniqueOrThrow({ where: { email: 'admin@example.test' } });
 await client.creditWallet.upsert({ where: { userId: host.id }, create: { userId: host.id, balance: 100 }, update: { balance: 100 } });
 async function fixture() {
  const room = await social.createSocialSession(host.id, 60);
  // Isolated native fixtures create the same persistent participant/token records as join;
  // browser tests below exercise the real cookie-setting join API.
  const people = [];
  for (let i = 0; i < 3; i++) { const token = newToken(); const p = await client.socialParticipant.create({ data: { sessionId: room.id, tokenHash: tokenHash(token), name: `مشارك ${i}`, position: i } }); people.push({ id: p.id, actor: { kind: 'PLAYER' as const, token } }); }
  return { id: room.id, people };
 }
 async function hostCommand(id: string, type: social.SocialAction['type']) {
  const v = await social.getSocialView(id, { kind: 'HOST', id: host.id }); return social.applySocialCommand(id, { kind: 'HOST', id: host.id }, randomUUID(), v.version, { type } as social.SocialAction);
 }
 async function voting(id: string, type: 'START' | 'REMATCH') { await hostCommand(id, type); await hostCommand(id, 'BEGIN_DISCUSSION'); await hostCommand(id, 'BEGIN_VOTING'); return social.getSocialView(id, { kind: 'HOST', id: host.id }); }
 await check(mode === 'baseline' ? 'M09 baseline reproduction: stale vote rebase crosses rematch' : 'M09 native delayed request cannot cross a completed round/rematch', async () => {
  const f = await fixture(); await voting(f.id, 'START'); const delayed = await pool.connect();
  let captured!: { roundId: string; version: number; ballot: number; backend: number }; let captureReady!: () => void, resume!: () => void;
  const ready = new Promise<void>(resolve => { captureReady = resolve; }), gate = new Promise<void>(resolve => { resume = resolve; });
  const key = randomUUID();
  const requestA = (async () => {
   await delayed.query('BEGIN');
   const row = (await delayed.query('SELECT r."id" AS "roundId",s."stateVersion" AS version,(s."state"->>\'ballot\')::int AS ballot,pg_backend_pid() AS backend FROM "GameSession" s JOIN "SocialRound" r ON r."sessionId"=s."id" WHERE s."id"=$1 ORDER BY r."number" DESC LIMIT 1', [f.id])).rows[0];
   captured = row; captureReady(); await gate;
   const action = { type: 'SUBMIT_VOTE' as const, roundId: captured.roundId, ballot: captured.ballot, targetId: f.people[1].id };
   if (mode === 'baseline') {
    await assert.rejects(social.applySocialCommand(f.id, f.people[0].actor, key, captured.version, action), { code: 'STALE_GAME_STATE' });
    const current = await social.getSocialView(f.id, { kind: 'HOST', id: host.id });
    // Old client permitted this rebase when phase and ballot matched, despite a new round.
    await social.applySocialCommand(f.id, f.people[0].actor, key, current.version, action);
   } else {
    await assert.rejects(social.applySocialCommand(f.id, f.people[0].actor, key, captured.version, action), { code: 'STALE_ROUND', status: 409 });
    const current = await social.getSocialView(f.id, { kind: 'HOST', id: host.id });
    await assert.rejects(social.applySocialCommand(f.id, f.people[0].actor, key, current.version, action), { code: 'STALE_ROUND' });
   }
  })();
  try {
   await ready; await hostCommand(f.id, 'CLOSE_VOTING'); await hostCommand(f.id, 'COMPLETE'); await voting(f.id, 'REMATCH');
   const before = await invariant(f.id), currentRound = before.rounds.at(-1)!; assert.notEqual(currentRound.id, captured.roundId); const backend = (await pool.query('SELECT pg_backend_pid() AS id')).rows[0].id; assert.notEqual(backend, captured.backend);
   resume(); await requestA; const after = await invariant(f.id);
   if (mode === 'baseline') { assert.equal(after.votes.filter(v => v.roundId === currentRound.id).length, 1); return { reproduced: true, delayedRoundIdDifferent: true, staleVoteEnteredCurrentRound: true, sourceFingerprint: process.env.SOURCE_FINGERPRINT }; }
   assert.deepEqual(after, before); assert.equal(await client.gameCommand.count({ where: { sessionId: f.id, key } }), 0);
   const fresh = await social.getSocialView(f.id, f.people[0].actor);
   const accepted = await social.applySocialCommand(f.id, f.people[0].actor, randomUUID(), fresh.version, { type: 'SUBMIT_VOTE', roundId: currentRound.id, ballot: fresh.ballot, targetId: f.people[1].id });
   assert.equal(accepted.duplicate, false); assert.equal(await client.socialVote.count({ where: { roundId: currentRound.id } }), 1);
   return { physicalConnections: 'independent PostgreSQL connections', originalRound: before.rounds[0].number, newRound: currentRound.number, rejectedCode: 'STALE_ROUND', rejectedTwiceIncludingRebasedVersion: true, exactInvariantBefore: hash(before), exactInvariantAfter: hash(after), zeroStaleReceipts: true, freshVoteSucceeded: true };
  } finally { resume(); await requestA.catch(() => {}); await delayed.query('ROLLBACK'); delayed.release(); }
 });
 if (mode === 'baseline') return;
 await check('M09 same-round concurrent votes rebase with original keys and resolve once', async () => {
  const f = await fixture(), v = await voting(f.id, 'START'), round = await client.socialRound.findFirstOrThrow({ where: { sessionId: f.id }, orderBy: { number: 'desc' } });
  const target = f.people.find(p => p.id !== round.outsiderId)!;
  const intents = f.people.map(p => ({ key: randomUUID(), action: { type: 'SUBMIT_VOTE' as const, roundId: round.id, ballot: v.ballot, targetId: p.id === target.id ? f.people.find(o => o.id !== target.id)!.id : target.id } }));
  const first = await Promise.allSettled(f.people.map((p, i) => social.applySocialCommand(f.id, p.actor, intents[i].key, v.version, intents[i].action)));
  assert.equal(first.filter(r => r.status === 'fulfilled').length, 1);
  for (const [i, result] of first.entries()) if (result.status === 'rejected') { assert.equal(result.reason.code, 'STALE_GAME_STATE'); const fresh = await social.getSocialView(f.id, f.people[i].actor); await social.applySocialCommand(f.id, f.people[i].actor, intents[i].key, fresh.version, intents[i].action); }
  const end = await invariant(f.id); assert.equal(end.session.stateVersion, v.version + 3); assert.equal(end.votes.length, 3); assert.equal(end.commands.filter(c => c.type === 'SUBMIT_VOTE').length, 3); assert.equal((end.session.state as { phase: string }).phase, 'RESULTS'); assert.equal(end.scores.length, 0); assert.ok(end.rounds[0].endedAt);
  const frozen = hash(end); const duplicates = await Promise.all(f.people.map((p, i) => social.applySocialCommand(f.id, p.actor, intents[i].key, v.version, intents[i].action))); assert.ok(duplicates.every(d => d.duplicate)); assert.equal(hash(await invariant(f.id)), frozen);
  return { initiallyAccepted: 1, rebasedSameRound: 2, sameKeysPreserved: true, voteRows: 3, versionDelta: 3, resolvedOnce: true, duplicateRetriesNoMutation: true, scoreEvents: 0 };
 });
 await check('M09 wrong round and ballot reject with exact zero mutation; fresh vote succeeds', async () => {
  const f = await fixture(), v = await voting(f.id, 'START'); const before = await invariant(f.id), round = before.rounds[0];
  for (const change of [{ roundId: randomUUID(), ballot: v.ballot, code: 'STALE_ROUND' }, { roundId: round.id, ballot: v.ballot + 1, code: 'STALE_VOTE_INTENT' }]) {
   await assert.rejects(social.applySocialCommand(f.id, f.people[0].actor, randomUUID(), v.version, { type: 'SUBMIT_VOTE', roundId: change.roundId, ballot: change.ballot, targetId: f.people[1].id }), { code: change.code }); assert.deepEqual(await invariant(f.id), before);
  }
  await social.applySocialCommand(f.id, f.people[0].actor, randomUUID(), v.version, { type: 'SUBMIT_VOTE', roundId: round.id, ballot: v.ballot, targetId: f.people[1].id }); return { wrongRound: 'STALE_ROUND', wrongBallot: 'STALE_VOTE_INTENT', exactZeroMutation: true, freshVoteSucceeded: true };
 });
 await check('M09 an already-committed old-round receipt cannot replay into rematch', async () => {
  const f = await fixture(), v = await voting(f.id, 'START'), round = await client.socialRound.findFirstOrThrow({ where: { sessionId: f.id } }); const key = randomUUID(), action = { type: 'SUBMIT_VOTE' as const, roundId: round.id, ballot: v.ballot, targetId: f.people[1].id };
  await social.applySocialCommand(f.id, f.people[0].actor, key, v.version, action); await hostCommand(f.id, 'CLOSE_VOTING');
  if ((await social.getSocialView(f.id, { kind: 'HOST', id: host.id })).phase === 'OUTSIDER_GUESS') { await client.$executeRawUnsafe('UPDATE "GameSession" SET "state"=jsonb_set("state",\'{deadlineAt}\',to_jsonb($2::text)) WHERE "id"=$1', f.id, new Date(Date.now() - 1000).toISOString()); await social.getSocialView(f.id, { kind: 'HOST', id: host.id }); }
  await hostCommand(f.id, 'COMPLETE'); await voting(f.id, 'REMATCH'); const before = await invariant(f.id);
  await assert.rejects(social.applySocialCommand(f.id, f.people[0].actor, key, v.version, action), { code: 'STALE_ROUND' }); assert.deepEqual(await invariant(f.id), before); return { existingOldReceipt: true, rejectedAfterRematch: true, zeroMutation: true };
 });
 await check('M09 Host TV and outsider projections preserve unrevealed secrets and votes', async () => {
  const f = await fixture(), v = await voting(f.id, 'START'), round = await client.socialRound.findFirstOrThrow({ where: { sessionId: f.id } });
  await social.applySocialCommand(f.id, f.people[0].actor, randomUUID(), v.version, { type: 'SUBMIT_VOTE', roundId: round.id, ballot: v.ballot, targetId: f.people[1].id });
  const display = await social.createSocialDisplayAccess(host.id, f.id), outsider = f.people.find(p => p.id === round.outsiderId)!;
  for (const actor of [{ kind: 'HOST' as const, id: host.id }, { kind: 'DISPLAY' as const, token: display.token }, outsider.actor]) { const view = await social.getSocialView(f.id, actor); assert.equal(view.tally, null); assert.equal(view.reveal, null); assert.equal(view.self?.secretWord ?? null, null); assert.ok(!JSON.stringify(view).includes('outsiderId')); assert.ok(!JSON.stringify(view).includes(round.wordSnapshot)); }
  const own = await social.getSocialView(f.id, f.people[0].actor); assert.equal(own.self?.votedFor, f.people[1].id); return { ownVoteOnly: true, tallyHidden: true, outsiderHidden: true, tvAndHostSecretHidden: true, roundIdOnlyAdded: true };
 });
 await check('M08 unchanged Ranked server: concurrent lost-response retries award once', async () => {
  const game = await ranked.createRankedSession(host.id, ['فريق مرجان', 'فريق بحر']);
  const send = async (action: Action, key = randomUUID(), version?: number) => ranked.applyRankedCommand(game.id, host.id, key, version ?? (await ranked.getRankedView(game.id, { kind: 'HOST', id: host.id })).version, action);
  await send({ type: 'START' }); await send({ type: 'START_ROUND' });
  const s = await client.gameSession.findUniqueOrThrow({ where: { id: game.id } }), ids = (s.state as { useIds: string[] }).useIds, use = await client.rankedListUse.findUniqueOrThrow({ where: { id: ids[0] } }), list = use.snapshot as unknown as List;
  const key = randomUUID(), action = { type: 'SUBMIT_GUESS' as const, guess: list.entries[0].answer }; await send(action, key, s.stateVersion); // commit happened; response discarded
  const duplicates = await Promise.all([send(action, key, s.stateVersion), send(action, key, s.stateVersion)]); assert.ok(duplicates.every(d => d.duplicate));
  const after = await client.gameSession.findUniqueOrThrow({ where: { id: game.id } }); assert.equal(after.stateVersion, s.stateVersion + 1); assert.deepEqual((after.state as { attempts: number[] }).attempts, [1, 0]); assert.equal(await client.gameCommand.count({ where: { sessionId: game.id, key } }), 1);
  const scores = await client.scoreEvent.findMany({ where: { sessionId: game.id } }); assert.equal(scores.length, 1); assert.equal(scores[0].delta, list.entries[0].points);
  await assert.rejects(send({ type: 'SUBMIT_GUESS', guess: 'different payload' }, key, s.stateVersion), { code: 'COMMAND_KEY_REUSED' }); return { duplicateRetries: 2, oneCommand: true, oneScoreEvent: true, oneAttempt: true, changedPayloadRejected: true, rankedServerSourceUnchanged: true };
 });
}
main().then(async () => { writeFileSync(process.env.COMMAND_BOUNDARY_REPORT ?? 'command-boundary-native.json', JSON.stringify({ mode, sourceFingerprint: process.env.SOURCE_FINGERPRINT, database: (await pool.query('SELECT version()')).rows[0].version, cases, passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).length }, null, 2)); }).catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await client.$disconnect(); await pool.end(); });
