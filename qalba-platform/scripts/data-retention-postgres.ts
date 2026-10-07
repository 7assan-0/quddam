/** Isolated native PostgreSQL acceptance: no production DB/provider/network. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { runRetention, retentionEligibilitySql, type RetentionOptions } from "../src/lib/retention/service";
import { retentionCutoffs, type RetentionKind } from "../src/lib/retention/policy";
import { newToken, tokenHash } from "../src/lib/auth/crypto";
import { validateActiveAuthSession } from "../src/lib/auth/host-stream";
import { pruneAuthAttempts } from "../src/lib/auth/abuse";
import { grantAdminCredits } from "../src/lib/billing/credits";
import { settleInvoice } from "../src/lib/billing/checkout";
import { confirmSupportRefund } from "../src/lib/billing/refunds";
import type { Invoice, PaymentProvider, ProviderPayment } from "../src/lib/billing/provider";
import { historyHref } from "../src/lib/games/history-policy";
import * as social from "../src/lib/games/social-deduction/service";
import * as court from "../src/lib/games/court/service";
import * as ranked from "../src/lib/games/ranked/service";
import * as letter from "../src/lib/games/letter-network/service";
import * as survey from "../src/lib/games/survey-battle/service";
import * as board from "../src/lib/games/category-board/service";
import type { SocialState } from "../src/lib/games/social-deduction/module";

if (!process.env.DATABASE_URL?.includes("127.0.0.1")) throw Error("Isolated native PostgreSQL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const client = new PrismaClient({ adapter: new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0]) });
(globalThis as unknown as { prisma: PrismaClient }).prisma = client;
const now = new Date(), ago = (days: number) => new Date(now.getTime() - days * 86400_000), future = new Date(now.getTime() + 86400_000);
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const cases: { name: string; passed: boolean; detail: unknown }[] = [];
let database = "";
function report() { writeFileSync(process.env.RETENTION_REPORT ?? "retention-native.json", JSON.stringify({ phase: "5.0E-1", sourceFingerprint: process.env.SOURCE_FINGERPRINT, database, nativePostgres: true, cases, passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).length, fullRegressionRun: false }, null, 2)); }
async function check(name: string, task: () => Promise<unknown>) { try { const detail = await task(); cases.push({ name, passed: true, detail }); report(); console.log("PASS", name); } catch (e) { cases.push({ name, passed: false, detail: String(e) }); report(); throw e; } }
const run = (kinds?: RetentionKind[], extra: RetentionOptions = {}) => runRetention({ now, kinds, batchSize: 500, ...extra }, client);
async function core(id: string) { return { session: await client.gameSession.findUniqueOrThrow({ where: { id } }), teams: await client.team.findMany({ where: { sessionId: id }, orderBy: { id: "asc" } }), commands: await client.gameCommand.findMany({ where: { sessionId: id }, orderBy: { id: "asc" } }), scores: await client.scoreEvent.findMany({ where: { sessionId: id }, orderBy: { id: "asc" } }) }; }
function historical<T extends { serverNow: string }>(view: T) { const { serverNow: _clock, ...stable } = view; void _clock; return stable; }
let host: { id: string; email: string }, admin: { id: string };
async function command(game: "social" | "court" | "ranked" | "letter" | "survey", id: string, action: { type: string; [key: string]: unknown }) {
  const s = await client.gameSession.findUniqueOrThrow({ where: { id } }), k = randomUUID();
  if (game === "social") return social.applySocialCommand(id, { kind: "HOST", id: host.id }, k, s.stateVersion, action as social.SocialAction);
  if (game === "court") return court.applyCourtCommand(id, host.id, k, s.stateVersion, action as Parameters<typeof court.applyCourtCommand>[4]);
  if (game === "ranked") return ranked.applyRankedCommand(id, host.id, k, s.stateVersion, action as Parameters<typeof ranked.applyRankedCommand>[4]);
  if (game === "letter") return letter.applyLetterCommand(id, host.id, k, s.stateVersion, action as letter.LetterAction);
  return survey.applySurveyCommand(id, host.id, k, s.stateVersion, action as survey.SurveyAction);
}
async function socialFixture() {
  const room = await social.createSocialSession(host.id, 60), people = [];
  for (let i = 0; i < 3; i++) { const token = newToken(), p = await client.socialParticipant.create({ data: { sessionId: room.id, name: `مشارك احتفاظ ${i}`, position: i, tokenHash: tokenHash(token) } }); people.push({ id: p.id, token }); }
  await command("social", room.id, { type: "START" }); return { id: room.id, people };
}
async function completeSocial(f: Awaited<ReturnType<typeof socialFixture>>) {
  await command("social", f.id, { type: "BEGIN_DISCUSSION" }); await command("social", f.id, { type: "BEGIN_VOTING" });
  const round = await client.socialRound.findFirstOrThrow({ where: { sessionId: f.id }, orderBy: { number: "desc" } });
  for (const p of f.people) { const s = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } }); const state = s.state as unknown as SocialState;
    await social.applySocialCommand(f.id, { kind: "PLAYER", token: p.token }, randomUUID(), s.stateVersion, { type: "SUBMIT_VOTE", roundId: round.id, ballot: state.ballot, targetId: p.id === round.outsiderId ? f.people.find(q => q.id !== p.id)!.id : round.outsiderId }); }
  const outsider = f.people.find(p => p.id === round.outsiderId)!; const s = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } });
  await social.applySocialCommand(f.id, { kind: "PLAYER", token: outsider.token }, randomUUID(), s.stateVersion, { type: "SUBMIT_GUESS", guess: round.wordSnapshot });
  await command("social", f.id, { type: "COMPLETE" }); await age(f.id); return round;
}
async function courtFixture() {
  const room = await court.createCourtSession(host.id, ["فريق مرجان", "فريق بحر"]), people = [];
  for (let i = 0; i < 4; i++) { const token = newToken(), p = await client.courtParticipant.create({ data: { sessionId: room.id, name: `محلف احتفاظ ${i}`, position: i, tokenHash: tokenHash(token) } }); people.push({ id: p.id, token }); }
  await command("court", room.id, { type: "START" }); await command("court", room.id, { type: "START_ROUND" }); await command("court", room.id, { type: "START_PREPARATION" });
  for (let i = 0; i < 5; i++) await command("court", room.id, { type: "ADVANCE_PHASE" });
  await court.submitCourtVote(room.id, people[0].token, randomUUID(), 1, 1, "PROSECUTION"); return { id: room.id, people };
}
async function age(id: string) { await client.gameSession.update({ where: { id }, data: { endedAt: ago(120) } }); await client.room.updateMany({ where: { sessionId: id }, data: { expiresAt: ago(120) } });
  await client.socialVote.updateMany({ where: { round: { sessionId: id } }, data: { createdAt: ago(120) } }); await client.courtRoundVote.updateMany({ where: { round: { sessionId: id } }, data: { createdAt: ago(120) } }); }

/** Pause after the REAL candidate query, before any cleanup lock/mutation.
 * A second PG connection then commits a changed lifecycle. No production hook. */
function afterDiscovery(task: () => Promise<void>) {
  let once = true;
  return new Proxy(client, { get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (property === "$queryRawUnsafe") return async (...args: unknown[]) => { const result = await value.apply(target, args); if (once) { once = false; await task(); } return result; };
    return typeof value === "function" ? value.bind(target) : value;
  } });
}
async function financial() {
  const tables = ["Purchase", "PurchaseRefund", "PaymentEvent", "CreditWallet", "GameCredit", "Coupon", "Product"];
  const result: Record<string, unknown> = {};
  for (const table of tables) result[table] = (await pool.query(`SELECT * FROM "${table}" ORDER BY ${table === "CreditWallet" ? '"userId"' : '"id"'}`)).rows;
  result.financialAnalytics = (await pool.query(`SELECT * FROM "AnalyticsEvent" WHERE "name" LIKE 'PURCHASE_%' OR "name" LIKE 'PAYMENT_%' OR "name" LIKE 'REFUND_%' ORDER BY "id"`)).rows;
  return result;
}

async function main() {
try {
  database = (await pool.query("SELECT version() AS version")).rows[0].version; assert.match(database, /^PostgreSQL /); assert.doesNotMatch(database, /PGlite/);
  host = await client.user.create({ data: { email: `retention-${randomUUID()}@example.test`, name: "مضيف احتفاظ" } }); admin = await client.user.findUniqueOrThrow({ where: { email: "admin@example.test" } });
  await grantAdminCredits(admin.id, host.email, 200, randomUUID());
  const sf = await socialFixture(), cf = await courtFixture();
  const rf = await ranked.createRankedSession(host.id, ["فريق قائمة", "فريق رتبة"]); await command("ranked", rf.id, { type: "START" }); await command("ranked", rf.id, { type: "START_ROUND" });
  const lf = await letter.createLetterSession(host.id, ["فريق حرف", "فريق شبكة"]); await command("letter", lf.id, { type: "START" }); const lv = await letter.getLetterView(lf.id, { kind: "HOST", id: host.id });
  await command("letter", lf.id, { type: "SELECT_CELL", cellId: lv.board[0].cellId }); await command("letter", lf.id, { type: "OPEN_QUESTION" });
  const vf = await survey.createSurveySession(host.id, ["فريق قالوا", "فريق الناس"]); await command("survey", vf.id, { type: "START" });
  await check("01 active Social/Court/Ranked/Letter/Survey private data and state remain byte-equivalent", async () => {
    const ids = [sf.id, cf.id, rf.id, lf.id, vf.id], before = await Promise.all(ids.map(core));
    const privateBefore = hash({ social: await client.socialRound.findMany(), votes: await client.courtRoundVote.findMany(), ranked: await client.rankedListUse.findMany(), letter: await client.letterQuestionUse.findMany(), survey: await client.surveyQuestionUse.findMany() });
    await run(); assert.deepEqual(await Promise.all(ids.map(core)), before);
    assert.equal(hash({ social: await client.socialRound.findMany(), votes: await client.courtRoundVote.findMany(), ranked: await client.rankedListUse.findMany(), letter: await client.letterQuestionUse.findMany(), survey: await client.surveyQuestionUse.findMany() }), privateBefore);
    const outside = (await client.socialRound.findFirstOrThrow({ where: { sessionId: sf.id } })).outsiderId;
    for (const p of sf.people) { const v = await social.getSocialView(sf.id, { kind: "PLAYER", token: p.token }); assert.equal(v.self!.secretWord !== null, p.id !== outside); }
    const cv = await court.getCourtView(cf.id, { kind: "HOST", id: host.id }); assert.equal(cv.verdict, null); assert.equal(cv.voteCount, 1); assert.doesNotMatch(JSON.stringify(cv), /prosecutionVotes|defenseVotes|"choice"/);
    const r = await ranked.getRankedView(rf.id, { kind: "HOST", id: host.id }); assert.ok(r.slots.every(slot => !Object.hasOwn(slot, "answer"))); return { activeSessions: ids.length, privateHashUnchanged: true, privacyPreserved: true };
  });
  const sr = await completeSocial(sf);
  for (let i = 1; i < cf.people.length; i++) await court.submitCourtVote(cf.id, cf.people[i].token, randomUUID(), 1, 1, i === 3 ? "DEFENSE" : "PROSECUTION");
  await command("court", cf.id, { type: "END_GAME" }); await command("court", cf.id, { type: "COMPLETE" }); await age(cf.id);
  await command("letter", lf.id, { type: "REVEAL_ANSWER" }); await command("letter", lf.id, { type: "CORRECT" }); await command("letter", lf.id, { type: "END_GAME" }); await command("letter", lf.id, { type: "COMPLETE" }); await age(lf.id);
  await command("survey", vf.id, { type: "ABANDON" }); await age(vf.id);
  const oldSocialView = historical(await social.getSocialView(sf.id, { kind: "HOST", id: host.id })), oldCourtView = historical(await court.getCourtView(cf.id, { kind: "HOST", id: host.id }));
  const oldLetterView = historical(await letter.getLetterView(lf.id, { kind: "HOST", id: host.id })), oldSurveyView = historical(await survey.getSurveyView(vf.id, { kind: "HOST", id: host.id }));
  await check("02 dry-run finds old private votes without mutating any table", async () => { const before = hash({ s: await core(sf.id), c: await core(cf.id), sr: await client.socialRound.findMany(), cr: await client.courtRound.findMany(), sv: await client.socialVote.findMany(), cv: await client.courtRoundVote.findMany(), sp: await client.socialParticipant.findMany() });
    const r = await run(["SocialVote", "CourtRoundVote", "SocialParticipant"], { dryRun: true }); assert.equal(r.eligible, 10); assert.equal(r.deleted + r.redacted, 0);
    assert.equal(hash({ s: await core(sf.id), c: await core(cf.id), sr: await client.socialRound.findMany(), cr: await client.courtRound.findMany(), sv: await client.socialVote.findMany(), cv: await client.courtRoundVote.findMany(), sp: await client.socialParticipant.findMany() }), before); return r; });
  await check("03 partially batched private-vote deletion preserves exact result and count", async () => { const r = await run(["SocialVote"], { batchSize: 1 }); assert.equal(r.deleted, 1); assert.equal(r.scanned, 1); assert.equal(r.hasMore, true); assert.deepEqual(historical(await social.getSocialView(sf.id, { kind: "HOST", id: host.id })), oldSocialView); return r; });
  await check("04 Social/Court private voter links removed; aggregate results and scores preserved", async () => { const before = [await core(sf.id), await core(cf.id)], r = await run(["SocialVote", "CourtRoundVote"]);
    assert.equal(r.deleted, 6); assert.equal(await client.socialVote.count({ where: { round: { sessionId: sf.id } } }), 0); assert.equal(await client.courtRoundVote.count({ where: { round: { sessionId: cf.id } } }), 0);
    assert.deepEqual([await core(sf.id), await core(cf.id)], before); assert.deepEqual(historical(await social.getSocialView(sf.id, { kind: "HOST", id: host.id })), oldSocialView); assert.deepEqual(historical(await court.getCourtView(cf.id, { kind: "HOST", id: host.id })), oldCourtView);
    return { deletedPrivateLinks: r.deleted, resultHashes: [hash(oldSocialView), hash(oldCourtView)], scoresAndVersionsUnchanged: true }; });
  await check("05 eligible participant hashes irreversibly invalidated without removing historical identities", async () => { const names = (await client.socialParticipant.findMany({ where: { sessionId: sf.id }, orderBy: { id: "asc" } })).map(p => ({ id: p.id, name: p.name, position: p.position }));
    const r = await run(["SocialParticipant", "CourtParticipant"]); assert.equal(r.redacted, 7); const people = await client.socialParticipant.findMany({ where: { sessionId: sf.id }, orderBy: { id: "asc" } }); assert.deepEqual(people.map(p => ({ id: p.id, name: p.name, position: p.position })), names); assert.ok(people.every(p => p.tokenHash.startsWith("retired:")));
    const before = await core(sf.id); for (const p of sf.people) await assert.rejects(social.applySocialCommand(sf.id, { kind: "PLAYER", token: p.token }, randomUUID(), before.session.stateVersion, { type: "FINISH_TURN" }), (e: unknown) => (e as { status?: number }).status === 403); assert.deepEqual(await core(sf.id), before); return { redacted: r.redacted, historyIdentitiesPreserved: true, H02NoMutation: true }; });
  await check("06 immutable H03 authored snapshots remain unchanged and never fall back to live bank", async () => { const before = await client.socialRound.findUniqueOrThrow({ where: { id: sr.id } }); await client.secretWord.update({ where: { id: sr.secretWordId }, data: { word: "كلمة بنك جديدة", alternativeAnswers: ["بديل بنك جديد"] } });
    const after = await client.socialRound.findUniqueOrThrow({ where: { id: sr.id } }); assert.equal(after.wordSnapshot, before.wordSnapshot); assert.deepEqual(after.alternativesSnapshot, before.alternativesSnapshot); assert.deepEqual(historical(await social.getSocialView(sf.id, { kind: "HOST", id: host.id })), oldSocialView);
    await assert.rejects(pool.query('UPDATE "SocialRound" SET "wordSnapshot"=$1 WHERE "id"=$2', ["forbidden rewrite", sr.id])); return { snapshotHash: hash({ word: after.wordSnapshot, aliases: after.alternativesSnapshot, origin: after.snapshotOrigin }), immutableTriggerIntact: true }; });
  await check("07 Letter/Survey snapshot history and M10 routes survive cleanup", async () => { await run(); assert.deepEqual(historical(await letter.getLetterView(lf.id, { kind: "HOST", id: host.id })), oldLetterView); assert.deepEqual(historical(await survey.getSurveyView(vf.id, { kind: "HOST", id: host.id })), oldSurveyView);
    for (const [id, prefix] of [[sf.id, "/social/host"], [lf.id, "/letter-network/host"], [cf.id, "/court/host"]]) { const s = await client.gameSession.findUniqueOrThrow({ where: { id }, include: { gameType: true } }); assert.equal(historyHref(s), `${prefix}/${id}`); }
    return { letterResultUnchanged: true, surveyResultUnchanged: true, dedicatedHistoryRoutes: 3 }; });
  await check("08 repeat cleanup is a zero-effect idempotent no-op", async () => { const r = await run(["SocialVote", "CourtRoundVote", "SocialParticipant", "CourtParticipant"]); assert.equal(r.deleted + r.redacted + r.failed, 0); return r; });
  await check("09 old expired/revoked auth and used/expired resets deleted; exact boundary/fresh artifacts retained", async () => {
    const old = await client.authSession.create({ data: { userId: host.id, tokenHash: tokenHash(newToken()), expiresAt: ago(31) } }); const revoked = await client.authSession.create({ data: { userId: host.id, tokenHash: tokenHash(newToken()), expiresAt: future, revokedAt: ago(31) } });
    const boundary = await client.authSession.create({ data: { userId: host.id, tokenHash: tokenHash(newToken()), expiresAt: ago(30) } }); const live = await client.authSession.create({ data: { userId: host.id, tokenHash: tokenHash(newToken()), expiresAt: future } });
    await client.passwordReset.create({ data: { userId: host.id, tokenHash: tokenHash(newToken()), expiresAt: ago(8) } }); await client.passwordReset.create({ data: { userId: host.id, tokenHash: tokenHash(newToken()), expiresAt: future, usedAt: ago(8) } }); const reset = await client.passwordReset.create({ data: { userId: host.id, tokenHash: tokenHash(newToken()), expiresAt: future } });
    const r = await run(["AuthSession", "PasswordReset"]); assert.equal(r.deleted, 4); for (const id of [old.id, revoked.id]) assert.equal(await client.authSession.findUnique({ where: { id } }), null);
    for (const id of [boundary.id, live.id]) assert.ok(await client.authSession.findUnique({ where: { id } })); assert.ok(await client.passwordReset.findUnique({ where: { id: reset.id } })); return { deleted: 4, boundaryAndNonExpiredRetained: true }; });
  await check("10 H01 logout/reset/explicit-revoke/expiry/suspension remain invalid before and after deletion", async () => {
    for (const reason of ["logout", "reset", "explicit-revoke", "expiry", "suspension"]) {
      const u = reason === "suspension" ? await client.user.create({ data: { email: `${randomUUID()}@example.test`, name: "موقوف", suspendedAt: ago(120) } }) : host;
      const s = await client.authSession.create({ data: { userId: u.id, tokenHash: tokenHash(newToken()), expiresAt: ago(120), revokedAt: ["logout", "reset", "explicit-revoke"].includes(reason) ? ago(120) : null } });
      assert.deepEqual(await validateActiveAuthSession(s.id, u.id), { status: "AUTH_INVALID" }); await run(["AuthSession"]); assert.equal(await client.authSession.findUnique({ where: { id: s.id } }), null); assert.deepEqual(await validateActiveAuthSession(s.id, u.id), { status: "AUTH_INVALID" });
    } return { originalAuthSemanticsUnchanged: true, invalidBeforeAndAfter: 5 }; });
  await check("11 display/clue/buzzer/controller expired artifacts removed, active-game and valid access excluded", async () => {
    const team = await client.team.findFirstOrThrow({ where: { sessionId: cf.id } });
    const shared = { sessionId: cf.id, tokenHash: tokenHash(newToken()), expiresAt: ago(120) };
    await client.displayAccess.create({ data: shared }); await client.forbiddenClueAccess.create({ data: { ...shared, tokenHash: tokenHash(newToken()), matchNumber: 1, roundIndex: 0 } }); await client.lightningBuzzerAccess.create({ data: { ...shared, tokenHash: tokenHash(newToken()), teamId: team.id, matchNumber: 1, permission: "TEAM_A_BUZZ" } }); await client.orderingControllerAccess.create({ data: { ...shared, tokenHash: tokenHash(newToken()), teamId: team.id, matchNumber: 1, permission: "ORDER_TEAM_A" } });
    const valid = await client.displayAccess.create({ data: { sessionId: cf.id, tokenHash: tokenHash(newToken()), expiresAt: future } }); const active = await client.displayAccess.create({ data: { sessionId: rf.id, tokenHash: tokenHash(newToken()), expiresAt: ago(120) } });
    const r = await run(["DisplayAccess", "ForbiddenClueAccess", "LightningBuzzerAccess", "OrderingControllerAccess"]); assert.equal(r.deleted, 4); assert.ok(await client.displayAccess.findUnique({ where: { id: valid.id } })); assert.ok(await client.displayAccess.findUnique({ where: { id: active.id } })); return { deleted: 4, activeParentPreserved: true, validCredentialPreserved: true }; });
  await check("12 Room/Bluff credential redaction retains history rows and correct names", async () => { const room = await client.room.findUniqueOrThrow({ where: { sessionId: sf.id } }); const p = await client.roomParticipant.create({ data: { roomId: room.id, name: "اسم تاريخي", tokenHash: tokenHash(newToken()) } }); const b = await client.bluffParticipant.create({ data: { sessionId: sf.id, name: "اسم صدقني تاريخي", position: 0, tokenHash: tokenHash(newToken()) } });
    const r = await run(["RoomParticipant", "BluffParticipant"]); assert.equal(r.redacted, 2); assert.equal((await client.roomParticipant.findUniqueOrThrow({ where: { id: p.id } })).tokenHash, null); assert.equal((await client.bluffParticipant.findUniqueOrThrow({ where: { id: b.id } })).name, b.name); return { redacted: 2, relationshipsPreserved: true }; });
  await check("13 abuse counters use existing 48-hour window and retain future security blocks", async () => { const old = tokenHash(newToken()), blocked = tokenHash(newToken()), recent = tokenHash(newToken()); await client.authAttempt.createMany({ data: [{ key: old, count: 1, windowStart: ago(3) }, { key: blocked, count: 1, windowStart: ago(3), blockedUntil: future }, { key: recent, count: 1, windowStart: now }] }); const r = await run(["AuthAttempt"]); assert.equal(r.deleted, 1); assert.ok(await client.authAttempt.findUnique({ where: { key: blocked } })); assert.ok(await client.authAttempt.findUnique({ where: { key: recent } })); assert.equal(await pruneAuthAttempts(client, now), 0); assert.ok(await client.authAttempt.findUnique({ where: { key: blocked } })); return { deleted: 1, activeBlockPreservedByBothPaths: true }; });
  await check("14 financial paid/refund/ledger/events/coupon/recovery/reconciliation rows remain logically byte-identical", async () => {
    // Avoid attributing unrelated welcome credits to this purchased-balance fixture.
    await client.featureFlag.update({ where: { key: "welcome-credits" }, data: { enabled: false } });
    const u = await client.user.create({ data: { email: `${randomUUID()}@example.test`, name: "سجل مالي" } }), product = await client.product.create({ data: { slug: randomUUID(), title: "Fixture", credits: 3, priceHalalas: 1500 } });
    const coupon = await client.coupon.create({ data: { code: randomUUID(), maxUses: 2, reservedCount: 1 } }), id = randomUUID(), ref = randomUUID(), pay = randomUUID();
    await client.purchase.create({ data: { id, userId: u.id, productId: product.id, couponId: coupon.id, couponReserved: true, amountHalalas: 1500, credits: 3, idempotencyKey: randomUUID(), provider: "moyasar", providerReference: ref, invoiceCreationState: "CREATED", createdAt: ago(150) } });
    const payment: ProviderPayment = { id: pay, invoice_id: ref, status: "refunded", amount: 1500, currency: "SAR", refunded: 1500, captured: 0, refunded_at: now.toISOString() };
    const invoice: Invoice = { id: ref, status: "paid", amount: 1500, currency: "SAR", metadata: { purchase_id: id }, payments: [payment] };
    await settleInvoice(id, { ...invoice, payments: [{ ...payment, status: "paid", refunded: 0 }] });
    await client.$transaction(async tx => { await tx.creditWallet.update({ where: { userId: u.id }, data: { balance: { decrement: 2 } } }); await tx.gameCredit.create({ data: { userId: u.id, delta: -2, reason: "Consumed fixture", idempotencyKey: randomUUID() } }); });
    const provider: PaymentProvider = { async createInvoice() { throw Error("No network"); }, async fetchInvoice() { return invoice; }, async fetchPayment() { return payment; } };
    await confirmSupportRefund(id, ref, pay, admin.id, provider);
    const pending = await client.purchase.create({ data: { userId: u.id, productId: product.id, couponId: coupon.id, couponReserved: true, amountHalalas: 1500, credits: 3, idempotencyKey: randomUUID(), createdAt: ago(150), provider: "moyasar", invoiceCreationState: "UNKNOWN_OUTCOME", invoiceCreationAttemptAt: ago(149), nextReconcileAt: now, reconcileAttemptCount: 4, reconcileLeaseId: randomUUID() } });
    await client.coupon.update({ where: { id: coupon.id }, data: { reservedCount: { increment: 1 } } });
    await client.analyticsEvent.updateMany({ where: { name: { startsWith: "PURCHASE_" } }, data: { occurredAt: ago(150) } });
    const before = await financial(), r = await run(); assert.deepEqual(await financial(), before); const refund = await client.purchaseRefund.findUniqueOrThrow({ where: { purchaseId: id } }); assert.equal(refund.unresolvedCredits, 2); assert.equal(refund.supportStatus, "SUPPORT_REQUIRED"); assert.equal((await client.purchase.findUniqueOrThrow({ where: { id: pending.id } })).invoiceCreationState, "UNKNOWN_OUTCOME");
    return { financialHashBefore: hash(before), financialHashAfter: hash(await financial()), preservedModels: Object.keys(before), unresolvedRefundCredits: 2, unknownInvoicePreserved: true, cleanup: r }; });
  await check("15 operational analytics expire; financial analytics and live-session events remain", async () => { const old = await client.analyticsEvent.create({ data: { name: "GAME_STARTED", occurredAt: ago(120) } }), live = await client.analyticsEvent.create({ data: { name: "GAME_STARTED", occurredAt: ago(120), properties: { sessionId: rf.id } } }); const finance = await client.analyticsEvent.create({ data: { name: "PURCHASE_COMPLETED", occurredAt: ago(120) } }); const r = await run(["AnalyticsEvent"]); assert.equal(r.deleted, 1); assert.equal(await client.analyticsEvent.findUnique({ where: { id: old.id } }), null); for (const id of [live.id, finance.id]) assert.ok(await client.analyticsEvent.findUnique({ where: { id } })); return { expiredOperational: 1, activeAndFinancialPreserved: true }; });
  await check("16 auth candidate renewed between discovery and lock is skipped on independent connection", async () => { const s = await client.authSession.create({ data: { userId: host.id, tokenHash: tokenHash(newToken()), expiresAt: ago(120) } }); const other = await pool.connect(); try { const observed = await other.query("SELECT pg_backend_pid() AS pid");
      const guarded = afterDiscovery(async () => { await other.query('UPDATE "AuthSession" SET "expiresAt"=$1 WHERE "id"=$2', [future, s.id]); }); const r = await runRetention({ now, kinds: ["AuthSession"], batchSize: 500 }, guarded); assert.equal(r.skipped, 1); assert.ok(await client.authSession.findUnique({ where: { id: s.id } })); return { skipped: 1, independentBackend: observed.rows[0].pid }; } finally { other.release(); } });
  await check("17 terminal game becomes active between discovery and mutation: private data skipped with zero state/version/wallet change", async () => { const f = await socialFixture(); await completeSocial(f); const before = await core(f.id), votesBefore = await client.socialVote.findMany({ where: { round: { sessionId: f.id } } });
    const other = await pool.connect(); try { let changed: unknown; const guarded = afterDiscovery(async () => { await other.query('UPDATE "GameSession" SET "status"=\'IN_PROGRESS\',"endedAt"=NULL WHERE "id"=$1', [f.id]); changed = await core(f.id); }); const wallet = hash(await client.creditWallet.findMany());
      const r = await runRetention({ now, kinds: ["SocialVote"] }, guarded); assert.equal(r.deleted, 0); assert.equal(r.skipped, 3); assert.deepEqual(await core(f.id), changed); assert.equal((await core(f.id)).session.stateVersion, before.session.stateVersion); assert.deepEqual(await client.socialVote.findMany({ where: { round: { sessionId: f.id } } }), votesBefore); assert.equal(hash(await client.creditWallet.findMany()), wallet); return { discovered: r.scanned, skipped: r.skipped, activePrivateLinksIntact: true, versionAndWalletUnchanged: true }; } finally { other.release(); } });
  await check("18 room expiry renewed after discovery prevents participant credential redaction", async () => { const b = await client.bluffParticipant.create({ data: { sessionId: cf.id, name: "مرشح متجدد", position: 0, tokenHash: tokenHash(newToken()) } }); const other = await pool.connect(); try { const guarded = afterDiscovery(async () => { await other.query('UPDATE "Room" SET "expiresAt"=$1 WHERE "sessionId"=$2', [future, cf.id]); }); const r = await runRetention({ now, kinds: ["BluffParticipant"] }, guarded); assert.equal(r.skipped, 1); assert.deepEqual(await client.bluffParticipant.findUniqueOrThrow({ where: { id: b.id } }), b); return { skipped: 1, credentialUnchanged: true }; } finally { other.release(); } });
  await check("19 two independent cleanup workers delete private links exactly once and preserve aggregates", async () => { const f = await socialFixture(); await completeSocial(f); const before = historical(await social.getSocialView(f.id, { kind: "HOST", id: host.id })); const secondPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 }); const second = new PrismaClient({ adapter: new PrismaPg(secondPool as unknown as ConstructorParameters<typeof PrismaPg>[0]) }); try {
      const [one, two] = await Promise.all([client.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`, second.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`]); assert.notEqual(one[0].pid, two[0].pid);
      const [a, b] = await Promise.all([runRetention({ now, kinds: ["SocialVote"] }, client), runRetention({ now, kinds: ["SocialVote"] }, second)]); assert.equal(a.failed + b.failed, 0); const final = await run(["SocialVote"]); assert.equal(a.deleted + b.deleted + final.deleted, 3); assert.equal(await client.socialVote.count({ where: { round: { sessionId: f.id } } }), 0); assert.deepEqual(historical(await social.getSocialView(f.id, { kind: "HOST", id: host.id })), before); return { workers: 2, distinctBackends: [one[0].pid, two[0].pid], deletionsExactlyOnce: 3, first: a, second: b, final }; } finally { await second.$disconnect(); await secondPool.end(); } });
  await check("20 exact globally bounded batch and stable cursor continue without skipping equal timestamps", async () => { for (let i = 0; i < 7; i++) await client.authSession.create({ data: { id: `e1-batch-${i}`, userId: host.id, tokenHash: tokenHash(newToken()), expiresAt: ago(200) } }); const a = await run(["AuthSession"], { batchSize: 3 }); assert.equal(a.scanned, 3); assert.equal(a.deleted, 3); assert.ok(a.nextCursor); const b = await run(["AuthSession"], { batchSize: 3, cursor: a.nextCursor! }); assert.equal(b.deleted, 3); const c = await run(["AuthSession"], { batchSize: 3, cursor: b.nextCursor! }); assert.equal(c.deleted, 1); assert.equal(c.hasMore, false); return { batches: [a.deleted, b.deleted, c.deleted], equalTimestampsSafe: true }; });
  await check("21 no private payload/token enters cleanup output and no financial identifier is a destructive target", async () => { const r = await run(undefined, { dryRun: true }); const json = JSON.stringify(r); for (const secret of [...sf.people.map(p => p.token), sr.wordSnapshot, ...cf.people.map(p => p.token)]) assert.ok(!json.includes(secret)); assert.doesNotMatch(json, /tokenHash|voterId|guess|wordSnapshot|paymentReference/); return { aggregatesOnly: true, outputBytes: Buffer.byteLength(json) }; });
  await check("22 representative indexed eligibility EXPLAIN on 2000 non-expired auth rows", async () => { await client.authSession.createMany({ data: Array.from({ length: 2000 }, () => ({ userId: host.id, tokenHash: tokenHash(newToken()), expiresAt: future })) }); await pool.query('ANALYZE "AuthSession"'); const c = retentionCutoffs(now); const plan = (await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM (${retentionEligibilitySql()}) c WHERE c."kind"='AuthSession' ORDER BY c."eligibleAt",c."id" LIMIT 101`, [c.auth, c.reset, c.access, c.privateVote, c.analytics, c.abuse, now])).rows[0]["QUERY PLAN"]; assert.ok(JSON.stringify(plan).includes("AuthSession_expiresAt_idx")); return { fixtureRows: 2000, plan, microScenarioOnly: true }; });
  await check("23 real Social REMATCH commits on another native connection after discovery; cleanup cannot touch either round", async () => {
    const f = await socialFixture(); await completeSocial(f); const votes = await client.socialVote.findMany({ where: { round: { sessionId: f.id } } });
    const secondPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 }), second = new PrismaClient({ adapter: new PrismaPg(secondPool as unknown as ConstructorParameters<typeof PrismaPg>[0]) });
    try {
      let committed: unknown; const wallet = hash(await client.creditWallet.findMany());
      const guarded = afterDiscovery(async () => {
        (globalThis as unknown as { prisma: PrismaClient }).prisma = second;
        try { const s = await second.gameSession.findUniqueOrThrow({ where: { id: f.id } }); await social.applySocialCommand(f.id, { kind: "HOST", id: host.id }, randomUUID(), s.stateVersion, { type: "REMATCH" }); }
        finally { (globalThis as unknown as { prisma: PrismaClient }).prisma = client; }
        committed = await core(f.id);
      });
      const r = await runRetention({ now, kinds: ["SocialVote"] }, guarded); assert.equal(r.skipped, 3); assert.equal(r.deleted, 0); assert.deepEqual(await core(f.id), committed); assert.deepEqual(await client.socialVote.findMany({ where: { round: { sessionId: f.id } } }), votes); assert.equal(hash(await client.creditWallet.findMany()), wallet);
      const newest = await client.socialRound.findFirstOrThrow({ where: { sessionId: f.id }, orderBy: { number: "desc" } }); assert.deepEqual(newest.retainedVoteCounts, {});
      return { realRematch: true, independentPool: true, skipped: 3, noCleanupMutationAfterRematch: true, freeRematchDebitUnchanged: true };
    } finally { await second.$disconnect(); await secondPool.end(); }
  });
  await check("24 failure between aggregate update and private deletion rolls back only that target; prior batch commit survives", async () => {
    const f = await socialFixture(); await completeSocial(f); const before = await client.socialRound.findMany({ where: { sessionId: f.id } });
    const old = await client.authSession.create({ data: { userId: host.id, expiresAt: ago(250), tokenHash: tokenHash(newToken()) } });
    const guarded = new Proxy(client, { get(target, property, receiver) {
      if (property === "$transaction") return <T>(cb: (tx: Prisma.TransactionClient) => Promise<T>, options?: { timeout?: number; maxWait?: number }) => target.$transaction(tx => cb(new Proxy(tx, { get(t, p, r) {
        const v = Reflect.get(t, p, r); if (p === "$executeRawUnsafe") return async (sql: string, ...args: unknown[]) => { if (sql.startsWith('DELETE FROM "SocialVote"')) throw Error("Injected infrastructure failure"); return v.apply(t, [sql, ...args]); }; return typeof v === "function" ? v.bind(t) : v;
      } })), options);
      const value = Reflect.get(target, property, receiver); return typeof value === "function" ? value.bind(target) : value;
    } });
    const r = await runRetention({ now, kinds: ["AuthSession", "SocialVote"] }, guarded); assert.equal(r.deleted, 1); assert.equal(r.failed, 3); assert.equal(await client.authSession.findUnique({ where: { id: old.id } }), null); assert.deepEqual(await client.socialRound.findMany({ where: { sessionId: f.id } }), before); assert.equal(await client.socialVote.count({ where: { round: { sessionId: f.id } } }), 3);
    const retry = await run(["SocialVote"]); assert.equal(retry.deleted, 3); assert.equal(retry.failed, 0); return { committedEarlierTarget: 1, rolledBackPrivateTargets: 3, successfulRetryTargets: 3 };
  });
  await check("25 old Category Board history/snapshots and command receipts retain safe duplicate retry", async () => {
    const categories = await board.eligibleBoardCategories(), f = await board.createBoardSession(host.id, { categoryIds: categories.slice(0, 6).map(c => c.id), teamNames: ["فريق لوحة", "فريق تحدي"], timerSeconds: 30 });
    const s = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } }), key = randomUUID(); await board.applyBoardCommand(host.id, f.id, key, s.stateVersion, { type: "START" });
    const started = await client.gameSession.findUniqueOrThrow({ where: { id: f.id } }); await board.applyBoardCommand(host.id, f.id, randomUUID(), started.stateVersion, { type: "END_GAME" }); await age(f.id); await client.gameCommand.updateMany({ where: { sessionId: f.id }, data: { createdAt: ago(120) } });
    const before = await core(f.id), view = historical(await board.getBoardSession(host.id, f.id)); await run(); assert.deepEqual(await core(f.id), before); assert.deepEqual(historical(await board.getBoardSession(host.id, f.id)), view); assert.equal(historyHref({ ...before.session, gameType: { slug: "category-board" } }), `/play/${f.id}`);
    const retry = await board.applyBoardCommand(host.id, f.id, key, s.stateVersion, { type: "START" }); assert.equal(retry.duplicate, true); assert.deepEqual(await core(f.id), before);
    return { route: "/play/[id]", historicalResultIntact: true, commandAgeDays: 120, oldRetryDeduplicated: true, versionsScoresUnchanged: true };
  });
  await check("26 contradictory terminal status with persisted active phase fails conservatively", async () => {
    await client.gameSession.update({ where: { id: rf.id }, data: { status: "COMPLETED", endedAt: ago(120) } });
    const before = await core(rf.id), access = await client.displayAccess.findMany({ where: { sessionId: rf.id } });
    const r = await run(["DisplayAccess"]); assert.equal(r.deleted, 0); assert.deepEqual(await core(rf.id), before); assert.deepEqual(await client.displayAccess.findMany({ where: { sessionId: rf.id } }), access);
    return { activePhaseDespiteStatusMismatchPreserved: true, stateVersionAndAccessUnchanged: true };
  });
} finally { report(); await client.$disconnect(); await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
