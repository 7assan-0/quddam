import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { newToken, tokenHash } from "../src/lib/auth/crypto";
import { grantAdminCredits } from "../src/lib/billing/credits";
import * as social from "../src/lib/games/social-deduction/service";
import * as letter from "../src/lib/games/letter-network/service";
import * as survey from "../src/lib/games/survey-battle/service";
import type { LetterState } from "../src/lib/games/letter-network/module";
import type { Survey } from "../src/lib/games/survey-battle/module";

if (!process.env.DATABASE_URL?.includes("127.0.0.1")) throw Error("Isolated native PostgreSQL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const client = new PrismaClient({ adapter: new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0]) });
type Hook = (model: string, operation: string, result: unknown, tx: Prisma.TransactionClient) => Promise<void>;
let hook: Hook | null = null;
function instrument(tx: Prisma.TransactionClient) {
  return new Proxy(tx, { get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof value === "function") return value.bind(target);
    if (!value || typeof value !== "object" || typeof property !== "string") return value;
    return new Proxy(value, { get(model, operation, modelReceiver) {
      const method = Reflect.get(model, operation, modelReceiver);
      if (typeof method !== "function") return method;
      return async (...args: unknown[]) => { const result = await method.apply(model, args); if (hook) await hook(property, String(operation), result, tx); return result; };
    } });
  } });
}
const guarded = new Proxy(client, { get(target, property, receiver) {
  if (property === "$transaction") return <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>, options?: { timeout?: number }) => target.$transaction(tx => callback(instrument(tx)), options);
  const value = Reflect.get(target, property, receiver); return typeof value === "function" ? value.bind(target) : value;
} });
(globalThis as unknown as { prisma: PrismaClient }).prisma = guarded;
const cases: { name: string; passed: boolean; detail: unknown }[] = [];
let database = "native PostgreSQL";
function saveReport() { writeFileSync(process.env.HISTORY_CONTENT_REPORT ?? "history-content-native.json", JSON.stringify({ phase: "5.0D-3", sourceFingerprint: process.env.SOURCE_FINGERPRINT, database, cases, passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).length, fullRegressionRun: false }, null, 2)); }
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Game = "social" | "letter" | "survey";
let host: { id: string; email: string };
async function check(name: string, run: () => Promise<unknown>) { try { const detail = await run(); cases.push({ name, passed: true, detail }); saveReport(); console.log("PASS", name); } catch (error) { cases.push({ name, passed: false, detail: String(error) }); saveReport(); throw error; } }
async function category(active = true) { return client.category.create({ data: { slug: `d3-${randomUUID()}`, title: "فئة اختبار أهلية", active } }); }
async function bank(game: Game) {
  if (game === "social") await client.category.updateMany({ where: { secretWords: { some: {} } }, data: { active: false } });
  if (game === "letter") await client.category.updateMany({ where: { letterQuestions: { some: {} } }, data: { active: false } });
  if (game === "survey") await client.category.updateMany({ where: { surveyQuestions: { some: {} } }, data: { active: false } });
  const a = await category(), b = await category(false), excluded = await category();
  for (const c of [a, b]) {
    if (game === "social") await client.secretWord.create({ data: { categoryId: c.id, word: `كلمة ${c.id.slice(0, 8)}`, alternativeAnswers: [`بديل ${c.id.slice(0, 8)}`], status: "PUBLISHED" } });
    if (game === "letter") for (const l of ["ا", "ب", "ج", "د", "ر"]) for (let i = 0; i < 8; i++) await client.letterQuestion.create({ data: { categoryId: c.id, letter: l, question: `سؤال ${l} ${i} ${c.id}`, answer: `${l}جابة ${i}`, alternativeAnswers: [], status: "PUBLISHED" } });
    if (game === "survey") for (let i = 0; i < 5; i++) await makeSurvey(c.id, i);
  }
  for (const status of ["DRAFT", "ARCHIVED"] as const) {
    if (game === "social") await client.secretWord.create({ data: { categoryId: excluded.id, word: "غير منشور", alternativeAnswers: [], status } });
    if (game === "letter") await client.letterQuestion.create({ data: { categoryId: excluded.id, letter: "ا", question: "غير منشور", answer: "اجابة", alternativeAnswers: [], status } });
    if (game === "survey") await makeSurvey(excluded.id, 20, status);
  }
  if (game === "social") await client.secretWord.create({ data: { categoryId: excluded.id, word: "English", language: "en", alternativeAnswers: [], status: "PUBLISHED" } });
  if (game === "letter") await client.letterQuestion.create({ data: { categoryId: excluded.id, letter: "ا", question: "إجابة لا توافق الحرف", answer: "باء", alternativeAnswers: [], status: "PUBLISHED" } });
  if (game === "survey") { await makeSurvey(excluded.id, 30, "PUBLISHED", "en"); await client.surveyQuestion.create({ data: { categoryId: excluded.id, question: "استطلاع غير صالح", difficulty: "EASY", status: "PUBLISHED", answers: { create: [{ answer: "واحد", alternativeAnswers: [], points: 50, position: 0 }] } } }); }
  return { a, b };
}
async function makeSurvey(categoryId: string, i: number, status: "DRAFT" | "PUBLISHED" | "ARCHIVED" = "PUBLISHED", locale = "ar-SA") {
  return client.surveyQuestion.create({ data: { categoryId, question: `استطلاع ${i} ${categoryId}`, difficulty: "EASY", status, locale,
    answers: { create: ["قهوة", "شاي", "ماء"].map((answer, position) => ({ answer, alternativeAnswers: [], points: [50, 30, 20][position], position })) } } });
}
async function fixture(game: Game) {
  if (game === "social") {
    const v = await social.createSocialSession(host.id, 60); const people = [];
    for (let i = 0; i < 3; i++) { const token = newToken(); const p = await client.socialParticipant.create({ data: { sessionId: v.id, position: i, name: `مشارك ${i}`, tokenHash: tokenHash(token) } }); people.push({ id: p.id, token }); }
    return { id: v.id, people };
  }
  const v = game === "letter" ? await letter.createLetterSession(host.id, ["فريق مرجان", "فريق بحر"]) : await survey.createSurveySession(host.id, ["فريق مرجان", "فريق بحر"]);
  return { id: v.id, people: [] as { id: string; token: string }[] };
}
async function command(game: Game, id: string, action: { type: string; cellId?: string; answerId?: string | null; teamIndex?: 0 | 1 }) {
  const s = await client.gameSession.findUniqueOrThrow({ where: { id } }); const key = randomUUID();
  if (game === "social") return social.applySocialCommand(id, { kind: "HOST", id: host.id }, key, s.stateVersion, action as social.SocialAction);
  if (game === "letter") return letter.applyLetterCommand(id, host.id, key, s.stateVersion, action as letter.LetterAction);
  return survey.applySurveyCommand(id, host.id, key, s.stateVersion, action as survey.SurveyAction);
}
async function invariant(id: string) {
  return { session: await client.gameSession.findUniqueOrThrow({ where: { id } }), teams: await client.team.findMany({ where: { sessionId: id }, orderBy: { id: "asc" } }),
    room: await client.room.findUnique({ where: { sessionId: id } }), people: await client.socialParticipant.findMany({ where: { sessionId: id }, orderBy: { id: "asc" } }),
    commands: await client.gameCommand.findMany({ where: { sessionId: id }, orderBy: { id: "asc" } }), scores: await client.scoreEvent.findMany({ where: { sessionId: id }, orderBy: { id: "asc" } }),
    socialRounds: await client.socialRound.findMany({ where: { sessionId: id }, orderBy: { id: "asc" } }), votes: await client.socialVote.findMany({ where: { round: { sessionId: id } }, orderBy: { id: "asc" } }),
    letterUses: await client.letterQuestionUse.findMany({ where: { sessionId: id }, orderBy: { id: "asc" } }), surveyUses: await client.surveyQuestionUse.findMany({ where: { sessionId: id }, orderBy: { id: "asc" } }),
    wallet: await client.creditWallet.findUnique({ where: { userId: host.id } }), credits: await client.gameCredit.findMany({ where: { userId: host.id }, orderBy: { id: "asc" } }),
    analytics: await client.analyticsEvent.findMany({ where: { userId: host.id }, orderBy: { id: "asc" } }) };
}
async function frozenFailure(id: string, operation: () => Promise<unknown>, expectedCode?: string) {
  const before = await invariant(id); await assert.rejects(operation, (error: unknown) => typeof error === "object" && error !== null && "status" in error && error.status === 409 && (!expectedCode || ("code" in error && error.code === expectedCode)));
  const after = await invariant(id); assert.deepEqual(after, before);
  return { before: hash(before), after: hash(after), beforePersisted: before, afterPersisted: after, exactZeroMutation: true, walletUnchanged: true, noSuccessReceipt: true };
}
function barrier(predicate: (model: string, operation: string, result: unknown) => boolean) {
  let ready!: () => void, resume!: () => void, captured: unknown, backend = 0, seen = false;
  const arrived = new Promise<void>(resolve => { ready = resolve; }), release = new Promise<void>(resolve => { resume = resolve; });
  hook = async (model, operation, result, tx) => {
    if (seen || !predicate(model, operation, result)) return; seen = true; captured = result;
    backend = (await tx.$queryRawUnsafe<{ id: number }[]>('SELECT pg_backend_pid() AS id'))[0].id; ready(); await release;
  };
  return { arrived, resume, captured: () => captured, backend: () => backend, close: () => { hook = null; resume(); } };
}
async function positive(game: Game) {
  const { a, b } = await bank(game), f = await fixture(game); await command(game, f.id, { type: "START" });
  if (game === "social") {
    const round = await client.socialRound.findFirstOrThrow({ where: { sessionId: f.id } }), word = await client.secretWord.findUniqueOrThrow({ where: { id: round.secretWordId } }); assert.equal(word.categoryId, a.id);
    const normal = f.people.find(p => p.id !== round.outsiderId)!, outsider = f.people.find(p => p.id === round.outsiderId)!;
    await client.category.update({ where: { id: a.id }, data: { active: false } });
    assert.equal((await social.getSocialView(f.id, { kind: "PLAYER", token: normal.token })).self?.secretWord, word.word);
    const display = await social.createSocialDisplayAccess(host.id, f.id);
    for (const actor of [{ kind: "HOST" as const, id: host.id }, { kind: "DISPLAY" as const, token: display.token }, { kind: "PLAYER" as const, token: outsider.token }]) assert.ok(!JSON.stringify(await social.getSocialView(f.id, actor)).includes(word.word));
    await command(game, f.id, { type: "BEGIN_DISCUSSION" }); await command(game, f.id, { type: "BEGIN_VOTING" });
    for (const person of f.people) { const view = await social.getSocialView(f.id, { kind: "PLAYER", token: person.token }); await social.applySocialCommand(f.id, { kind: "PLAYER", token: person.token }, randomUUID(), view.version, { type: "SUBMIT_VOTE", roundId: round.id, ballot: view.ballot, targetId: person.id === outsider.id ? normal.id : outsider.id }); }
    const guess = await social.getSocialView(f.id, { kind: "PLAYER", token: outsider.token }); assert.equal(guess.phase, "OUTSIDER_GUESS");
    await social.applySocialCommand(f.id, { kind: "PLAYER", token: outsider.token }, randomUUID(), guess.version, { type: "SUBMIT_GUESS", guess: word.alternativeAnswers[0] });
    assert.equal((await social.getSocialView(f.id, { kind: "HOST", id: host.id })).reveal?.secretWord, word.word);
    await command(game, f.id, { type: "COMPLETE" });
    const ended = await client.socialRound.findUniqueOrThrow({ where: { id: round.id } }); assert.equal(ended.wordSnapshot, word.word); assert.deepEqual(ended.alternativesSnapshot, word.alternativeAnswers);
    await client.category.update({ where: { id: b.id }, data: { active: true } }); await command(game, f.id, { type: "REMATCH" });
    const next = await client.socialRound.findFirstOrThrow({ where: { sessionId: f.id }, orderBy: { number: "desc" }, include: { secretWord: true } }); assert.equal(next.secretWord.categoryId, b.id);
  } else if (game === "letter") {
    let state = (await client.gameSession.findUniqueOrThrow({ where: { id: f.id } })).state as unknown as LetterState;
    assert.equal(state.board.length, 25); await command(game, f.id, { type: "SELECT_CELL", cellId: state.board[0].cellId }); await command(game, f.id, { type: "OPEN_QUESTION" });
    const use = await client.letterQuestionUse.findFirstOrThrow({ where: { sessionId: f.id }, include: { question: true } }); assert.equal(use.question.categoryId, a.id);
    await client.category.update({ where: { id: a.id }, data: { active: false } }); const display = await letter.createLetterDisplayAccess(host.id, f.id);
    assert.equal((await letter.getLetterView(f.id, { kind: "HOST", id: host.id })).question?.text, use.questionSnapshot);
    assert.ok(!JSON.stringify(await letter.getLetterView(f.id, { kind: "DISPLAY", token: display.token })).includes(use.answerSnapshot));
    await command(game, f.id, { type: "REVEAL_ANSWER" }); assert.equal((await letter.getLetterView(f.id, { kind: "HOST", id: host.id })).question?.answer, use.answerSnapshot);
    assert.ok(!JSON.stringify(await letter.getLetterView(f.id, { kind: "DISPLAY", token: display.token })).includes(use.answerSnapshot)); await command(game, f.id, { type: "CORRECT" });
    state = (await client.gameSession.findUniqueOrThrow({ where: { id: f.id } })).state as unknown as LetterState;
    const cell = state.board.find(c => c.state === "AVAILABLE")!; await frozenFailure(f.id, () => command(game, f.id, { type: "SELECT_CELL", cellId: cell.cellId }), "LETTER_EXHAUSTED");
    await client.category.update({ where: { id: b.id }, data: { active: true } }); await command(game, f.id, { type: "SELECT_CELL", cellId: cell.cellId });
    const future = await client.letterQuestionUse.findFirstOrThrow({ where: { sessionId: f.id, id: { not: use.id } }, include: { question: true } }); assert.equal(future.question.categoryId, b.id);
    const old = await client.letterQuestionUse.findUniqueOrThrow({ where: { id: use.id } }); assert.equal(old.questionSnapshot, use.questionSnapshot); assert.equal(old.answerSnapshot, use.answerSnapshot);
    await command(game, f.id, { type: "END_GAME" }); await command(game, f.id, { type: "COMPLETE" }); await command(game, f.id, { type: "REMATCH" });
  } else {
    const uses = await client.surveyQuestionUse.findMany({ where: { sessionId: f.id }, include: { question: true }, orderBy: { roundNumber: "asc" } }); assert.equal(uses.length, 5); assert.ok(uses.every(u => u.question.categoryId === a.id));
    await client.category.update({ where: { id: a.id }, data: { active: false } }); const snapshot = uses[0].snapshot as unknown as Survey, display = await survey.createSurveyDisplayAccess(host.id, f.id);
    assert.equal((await survey.getSurveyView(f.id, { kind: "HOST", id: host.id })).question?.text, snapshot.question);
    assert.ok(!JSON.stringify(await survey.getSurveyView(f.id, { kind: "DISPLAY", token: display.token })).includes(snapshot.answers[0].answer));
    await command(game, f.id, { type: "START_ROUND" }); await command(game, f.id, { type: "FACE_OFF_GUESS", teamIndex: 0, answerId: snapshot.answers[0].id }); await command(game, f.id, { type: "FACE_OFF_GUESS", teamIndex: 1, answerId: null }); await command(game, f.id, { type: "BEGIN_ANSWERING" }); await command(game, f.id, { type: "GUESS_CORRECT", answerId: snapshot.answers[1].id });
    await command(game, f.id, { type: "END_GAME" }); await command(game, f.id, { type: "COMPLETE" });
    await client.category.update({ where: { id: b.id }, data: { active: true } }); await command(game, f.id, { type: "REMATCH" });
    const all = await client.surveyQuestionUse.findMany({ where: { sessionId: f.id }, include: { question: true } }); assert.equal(all.length, 10); assert.ok(all.filter(u => u.matchNumber === 2).every(u => u.question.categoryId === b.id));
    for (const use of uses) assert.deepEqual(all.find(u => u.id === use.id)!.snapshot, use.snapshot);
  }
  return { activePublishedSelected: true, inactiveDraftArchivedAndInvalidExcluded: true, existingSnapshotUsableAfterDeactivation: true, reactivationFutureSelection: true, otherCategoryContinues: true, privacyPreserved: true, rulesUnchanged: true };
}
async function race(game: Game, question = false) {
  const { a } = await bank(game), f = await fixture(game);
  let action: { type: string; cellId?: string } = { type: "START" };
  if (question) { await command(game, f.id, action); const state = (await client.gameSession.findUniqueOrThrow({ where: { id: f.id } })).state as unknown as LetterState; action = { type: "SELECT_CELL", cellId: state.board[0].cellId }; }
  const gate = barrier((model, operation) => operation === "findMany" && model === (game === "social" ? "secretWord" : game === "letter" ? "letterQuestion" : "surveyQuestion"));
  const before = await invariant(f.id), operation = command(game, f.id, action); const settled = operation.then(() => ({ accepted: true as const }), error => ({ accepted: false as const, error }));
  try {
    await gate.arrived; const admin = await pool.connect(); let adminBackend = 0;
    try { adminBackend = (await admin.query('SELECT pg_backend_pid() AS id')).rows[0].id; assert.notEqual(adminBackend, gate.backend()); await admin.query('UPDATE "Category" SET "active"=false WHERE "id"=$1', [a.id]); }
    finally { admin.release(); }
    gate.resume(); const result = await settled; assert.equal(result.accepted, false); if (result.accepted) throw Error("Inactive content committed"); assert.equal(result.error.status, 409);
    const after = await invariant(f.id); assert.deepEqual(after, before);
    return { independentConnections: true, selectorBackend: gate.backend(), adminBackend, discoveredWhileActive: true, adminDeactivationCommittedBeforeResume: true, rejectedStatus: result.error.status, rejectedCode: result.error.code, before: hash(before), after: hash(after), beforePersisted: before, afterPersisted: after, exactZeroMutation: true, walletUnchanged: true, noCommittedRoundUseOrStartReceipt: true };
  } finally { gate.close(); await settled; }
}
async function partialSurveyRollback() {
  await bank("survey"); await client.category.updateMany({ where: { surveyQuestions: { some: {} } }, data: { active: false } });
  for (let i = 0; i < 5; i++) await makeSurvey((await category()).id, i);
  const f = await fixture("survey"); let reads = 0, provisionalWrites = 0;
  const gate = barrier((model, operation) => { if (model === "surveyQuestionUse" && operation === "create") provisionalWrites++; return model === "surveyQuestion" && operation === "findUniqueOrThrow" && ++reads === 3; });
  const before = await invariant(f.id), operation = command("survey", f.id, { type: "START" }); const outcome = operation.then(() => null, error => error);
  try {
    await gate.arrived; const q = gate.captured() as { categoryId: string }; assert.equal(provisionalWrites, 2);
    await pool.query('UPDATE "Category" SET "active"=false WHERE "id"=$1', [q.categoryId]); gate.resume(); const error = await outcome; assert.equal(error?.code, "CONTENT_CHANGED");
    const after = await invariant(f.id); assert.deepEqual(after, before); return { provisionalSnapshotWrites: 2, committedSnapshotWrites: 0, rejectedCode: error.code, before: hash(before), after: hash(after), beforePersisted: before, afterPersisted: after, walletUnchanged: true, transactionRolledBack: true };
  } finally { gate.close(); await outcome; }
}
async function main() {
  database = (await pool.query("SELECT version()")).rows[0].version;
  host = await client.user.findUniqueOrThrow({ where: { email: "admin@example.test" }, select: { id: true, email: true } }); await grantAdminCredits(host.id, host.email, 200, randomUUID());
  for (const game of ["social", "letter", "survey"] as const) await check(`M11 ${game}: eligibility, immutable active snapshot, reactivation and remaining category`, () => positive(game));
  for (const game of ["social", "letter", "survey"] as const) await check(`M11 ${game}: START exhaustion rolls back exact persisted state and debit`, async () => {
    const { a, b } = await bank(game), f = await fixture(game); await client.category.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { active: false } }); return frozenFailure(f.id, () => command(game, f.id, { type: "START" }));
  });
  for (const game of ["social", "letter", "survey"] as const) await check(`M11 ${game}: candidate discovery vs committed category deactivation`, () => race(game));
  await check("M11 letter: question discovery vs deactivation leaves board unchanged", () => race("letter", true));
  await check("M11 survey: later category conflict rolls back two provisional snapshots", partialSurveyRollback);
  // Restore disposable seed category flags before focused D-2 regression harness runs.
  await client.category.updateMany({ data: { active: true } });
  saveReport();
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { hook = null; await client.$disconnect(); await pool.end(); });
