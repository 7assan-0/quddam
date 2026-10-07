/** Synthetic native PostgreSQL fixtures. Never an application startup/seed hook. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { db } from "../src/lib/db";
import { newToken, tokenHash } from "../src/lib/auth/crypto";
import { grantAdminCredits } from "../src/lib/billing/credits";
import { settleInvoice } from "../src/lib/billing/checkout";
import { confirmSupportRefund } from "../src/lib/billing/refunds";
import type { Invoice, PaymentProvider, ProviderPayment } from "../src/lib/billing/provider";
import * as board from "../src/lib/games/category-board/service";
import * as social from "../src/lib/games/social-deduction/service";
import * as letter from "../src/lib/games/letter-network/service";
import * as survey from "../src/lib/games/survey-battle/service";
import * as forbidden from "../src/lib/games/forbidden-word/service";
import * as bluff from "../src/lib/games/bluff/service";
import * as ranked from "../src/lib/games/ranked/service";
import * as lightning from "../src/lib/games/lightning/service";
import * as ordering from "../src/lib/games/ordering/service";
import * as court from "../src/lib/games/court/service";
export const games = ["board", "social", "letter", "survey", "forbidden", "bluff", "ranked", "lightning", "ordering", "court"] as const;
export type Game = typeof games[number];
export const hostId = "f1-host", adminId = "f1-admin";
export type Fixture = { id: string; game: Game; people: { id: string; token: string }[]; startKey: string };
export type Context = { hostToken: string; active: Fixture[]; completed: Fixture[]; financial: Awaited<ReturnType<typeof financialFixture>>; unknownPurchaseId: string };
const actor = { kind: "HOST" as const, id: hostId };
export async function act(f: Pick<Fixture, "id" | "game">, action: { type: string; [key: string]: unknown }, key: string = randomUUID()) {
  const v = (await db().gameSession.findUniqueOrThrow({ where: { id: f.id } })).stateVersion;
  switch (f.game) {
    case "board": return board.applyBoardCommand(hostId, f.id, key, v, action as Parameters<typeof board.applyBoardCommand>[4]);
    case "social": return social.applySocialCommand(f.id, actor, key, v, action as social.SocialAction);
    case "letter": return letter.applyLetterCommand(f.id, hostId, key, v, action as letter.LetterAction);
    case "survey": return survey.applySurveyCommand(f.id, hostId, key, v, action as Parameters<typeof survey.applySurveyCommand>[4]);
    case "forbidden": return forbidden.applyForbiddenCommand(f.id, hostId, key, v, action as Parameters<typeof forbidden.applyForbiddenCommand>[4]);
    case "bluff": return bluff.applyBluffCommand(f.id, actor, key, v, action as Parameters<typeof bluff.applyBluffCommand>[4]);
    case "ranked": return ranked.applyRankedCommand(f.id, hostId, key, v, action as Parameters<typeof ranked.applyRankedCommand>[4]);
    case "lightning": return lightning.applyLightningCommand(f.id, hostId, key, v, action as Parameters<typeof lightning.applyLightningCommand>[4]);
    case "ordering": return ordering.applyOrderingCommand(f.id, hostId, key, v, action as Parameters<typeof ordering.applyOrderingCommand>[4]);
    case "court": return court.applyCourtCommand(f.id, hostId, key, v, action as Parameters<typeof court.applyCourtCommand>[4]);
  }
}
export async function view(f: Pick<Fixture, "id" | "game">) {
  switch (f.game) {
    case "board": return board.getBoardSession(hostId, f.id);
    case "social": return social.getSocialView(f.id, actor);
    case "letter": return letter.getLetterView(f.id, actor);
    case "survey": return survey.getSurveyView(f.id, actor);
    case "forbidden": return forbidden.getForbiddenView(f.id, actor);
    case "bluff": return bluff.getBluffView(f.id, actor);
    case "ranked": return ranked.getRankedView(f.id, actor);
    case "lightning": return lightning.getLightningView(f.id, actor);
    case "ordering": return ordering.getOrderingView(f.id, actor);
    case "court": return court.getCourtView(f.id, actor);
  }
}
export async function createFixture(game: Game, start = true): Promise<Fixture> {
  const names: [string, string] = ["فريق قدّام الأول", "فريق قدّام الثاني"];
  let id: string;
  switch (game) {
    case "board": { const categories = await board.eligibleBoardCategories(); id = (await board.createBoardSession(hostId, { categoryIds: categories.slice(0, 6).map(c => c.id), teamNames: names, timerSeconds: 60 })).id; break; }
    case "social": id = (await social.createSocialSession(hostId, 60)).id; break;
    case "letter": id = (await letter.createLetterSession(hostId, names)).id; break;
    case "survey": id = (await survey.createSurveySession(hostId, names)).id; break;
    case "forbidden": id = (await forbidden.createForbiddenSession(hostId, names)).id; break;
    case "bluff": id = (await bluff.createBluffSession(hostId)).id; break;
    case "ranked": id = (await ranked.createRankedSession(hostId, names)).id; break;
    case "lightning": id = (await lightning.createLightningSession(hostId, names)).id; break;
    case "ordering": id = (await ordering.createOrderingSession(hostId, names)).id; break;
    case "court": id = (await court.createCourtSession(hostId, names)).id; break;
  }
  const people: Fixture["people"] = [];
  if (["social", "bluff", "court"].includes(game)) for (let i = 0; i < 4; i++) {
    const token = newToken(), data = { sessionId: id, name: `مشارك ترقية ${i}`, position: i, tokenHash: tokenHash(token) };
    const p = game === "social" ? await db().socialParticipant.create({ data }) : game === "bluff" ? await db().bluffParticipant.create({ data }) : await db().courtParticipant.create({ data });
    people.push({ id: p.id, token });
  }
  const f = { id, game, people, startKey: randomUUID() }; if (start) await act(f, { type: "START" }, f.startKey); return f;
}
/** Serve and resolve a real question BEFORE upgrading; an unplayed board proves no answer snapshot. */
async function prepareLetterSnapshot(f: Fixture) {
  const state = (await db().gameSession.findUniqueOrThrow({ where: { id: f.id } })).state as { board: { cellId: string; state: string }[] };
  const cell = state.board.find(c => c.state === "AVAILABLE"); assert.ok(cell);
  await act(f, { type: "SELECT_CELL", cellId: cell.cellId });
  await act(f, { type: "OPEN_QUESTION" }); await act(f, { type: "REVEAL_ANSWER" }); await act(f, { type: "CORRECT" });
  assert.equal(await db().letterQuestionUse.count({ where: { sessionId: f.id } }), 1);
  assert.ok((await letter.getLetterView(f.id, actor)).lastAnswer);
}
export async function complete(f: Fixture) {
  if (f.game === "social") {
    await act(f, { type: "BEGIN_DISCUSSION" }); await act(f, { type: "BEGIN_VOTING" });
    const round = await db().socialRound.findFirstOrThrow({ where: { sessionId: f.id }, orderBy: { number: "desc" } });
    for (const p of f.people) {
      const s = await db().gameSession.findUniqueOrThrow({ where: { id: f.id } }), st = s.state as { ballot: number };
      await social.applySocialCommand(f.id, { kind: "PLAYER", token: p.token }, randomUUID(), s.stateVersion, { type: "SUBMIT_VOTE", roundId: round.id, ballot: st.ballot, targetId: p.id === round.outsiderId ? f.people.find(q => q.id !== p.id)!.id : round.outsiderId });
    }
    const outsider = f.people.find(p => p.id === round.outsiderId)!;
    const s = await db().gameSession.findUniqueOrThrow({ where: { id: f.id } });
    await social.applySocialCommand(f.id, { kind: "PLAYER", token: outsider.token }, randomUUID(), s.stateVersion, { type: "SUBMIT_GUESS", guess: round.wordSnapshot });
  } else if (f.game === "forbidden") {
    await act(f, { type: "PREPARE_ROUND" });
    for (let i = 0; i < 6; i++) {
      await act(f, { type: "START_ROUND" });
      // Test-fixture clock only: existing authoritative timeout then advances normally.
      await db().$executeRaw`UPDATE "GameSession" SET state=jsonb_set(state,'{deadlineAt}',to_jsonb(${new Date(Date.now() - 1000).toISOString()}::text)) WHERE id=${f.id}`;
      await view(f); await act(f, { type: "NEXT_ROUND" });
    }
  } else if (f.game === "ranked") {
    for (let i = 0; i < 5; i++) { await act(f, { type: "START_ROUND" }); await act(f, { type: "END_ROUND" }); await act(f, { type: "NEXT_ROUND" }); }
  } else {
    if (f.game === "court") {
      await act(f, { type: "START_ROUND" }); await act(f, { type: "START_PREPARATION" });
      for (let i = 0; i < 5; i++) await act(f, { type: "ADVANCE_PHASE" });
      for (const [i, p] of f.people.entries()) await court.submitCourtVote(f.id, p.token, randomUUID(), 1, 1, i < 3 ? "PROSECUTION" : "DEFENSE");
    }
    await act(f, { type: "END_GAME" });
  }
  if (f.game !== "board") await act(f, { type: "COMPLETE" });
  assert.equal((await db().gameSession.findUniqueOrThrow({ where: { id: f.id } })).status, "COMPLETED");
}
export async function financialFixture() {
  const product = await db().product.create({ data: { slug: `f1-${randomUUID()}`, title: "باقة اختبار الاسترداد", credits: 3, priceHalalas: 1500, active: true } });
  const user = await db().user.create({ data: { email: `${randomUUID()}@example.test`, name: "رصيد دعم الاختبار" } });
  const coupon = await db().coupon.create({ data: { code: randomUUID().toUpperCase(), active: true, maxUses: 1, discountPercent: 10, reservedCount: 1 } });
  const purchaseId = randomUUID(), invoiceId = randomUUID();
  const payment: ProviderPayment = { id: randomUUID(), invoice_id: invoiceId, status: "refunded", amount: 1350, currency: "SAR", refunded: 1350, captured: 0, refunded_at: new Date().toISOString() };
  const invoice: Invoice = { id: invoiceId, status: "paid", amount: 1350, currency: "SAR", metadata: { purchase_id: purchaseId }, payments: [payment] };
  await db().purchase.create({ data: { id: purchaseId, userId: user.id, productId: product.id, couponId: coupon.id, couponReserved: true, provider: "moyasar", providerReference: invoiceId, amountHalalas: 1350, credits: 3, invoiceCreationState: "CREATED", invoiceCreationAttemptAt: new Date(), idempotencyKey: randomUUID() } });
  await settleInvoice(purchaseId, { ...invoice, payments: [{ ...payment, status: "paid", refunded: 0 }] });
  await db().$transaction(async tx => { await tx.creditWallet.update({ where: { userId: user.id }, data: { balance: { decrement: 2 } } }); await tx.gameCredit.create({ data: { userId: user.id, delta: -2, reason: "استهلاك اختبار", idempotencyKey: randomUUID() } }); });
  const provider: PaymentProvider = { async createInvoice() { throw Error("No external creation"); }, async fetchInvoice() { return invoice; }, async fetchPayment() { return payment; } };
  await confirmSupportRefund(purchaseId, invoice.id, payment.id, adminId, provider);
  return { purchaseId, invoice, payment, userId: user.id };
}
export async function populate(): Promise<Context> {
  await db().featureFlag.update({ where: { key: "welcome-credits" }, data: { enabled: false, config: { count: 0 } } });
  await grantAdminCredits(adminId, "f1-host@example.test", 500, "f1-fixture-credit");
  const hostToken = newToken(); await db().authSession.create({ data: { userId: hostId, tokenHash: tokenHash(hostToken), expiresAt: new Date(Date.now() + 86400_000) } });
  const active: Fixture[] = [], completed: Fixture[] = [];
  for (const game of games) {
    const running = await createFixture(game); if (game === "letter") await prepareLetterSnapshot(running); active.push(running);
    const f = await createFixture(game); if (game === "letter") await prepareLetterSnapshot(f); await complete(f); completed.push(f);
  }
  const financial = await financialFixture();
  const product = await db().product.findFirstOrThrow({ where: { active: true } });
  for (const status of ["FAILED", "CANCELED", "EXPIRED", "VOIDED"] as const) await db().purchase.create({ data: { userId: hostId, productId: product.id, amountHalalas: product.priceHalalas, credits: product.credits, status, provider: "moyasar", providerReference: randomUUID(), idempotencyKey: randomUUID() } });
  const unknown = await db().purchase.create({ data: { userId: hostId, productId: product.id, amountHalalas: product.priceHalalas, credits: product.credits, provider: "moyasar", invoiceCreationState: "UNKNOWN_OUTCOME", invoiceCreationAttemptAt: new Date(), expiresAt: new Date(Date.now() + 86400_000), reconcileAttemptCount: 2, nextReconcileAt: new Date(Date.now() - 1000), idempotencyKey: randomUUID() } });
  const old = new Date(Date.now() - 120 * 86400_000);
  for (let i = 0; i < 7; i++) await db().authSession.create({ data: { userId: hostId, tokenHash: tokenHash(newToken()), expiresAt: old, revokedAt: old } });
  for (const f of completed) { await db().gameSession.update({ where: { id: f.id }, data: { endedAt: old } }); await db().room.updateMany({ where: { sessionId: f.id }, data: { expiresAt: old } }); }
  await db().socialVote.updateMany({ where: { round: { sessionId: { in: completed.map(f => f.id) } } }, data: { createdAt: old } });
  const c = active.find(f => f.game === "court")!;
  await act(c, { type: "START_ROUND" }); await act(c, { type: "START_PREPARATION" }); for (let i = 0; i < 5; i++) await act(c, { type: "ADVANCE_PHASE" });
  await court.submitCourtVote(c.id, c.people[0].token, randomUUID(), 1, 1, "PROSECUTION");
  await db().$executeRaw`UPDATE "GameSession" SET state=jsonb_set(state,'{deadlineAt}',to_jsonb(${Date.now() + 3600_000}::bigint)) WHERE id=${c.id}`;
  for (const f of active.filter(f => !["social", "bluff", "court"].includes(f.game))) await db().displayAccess.create({ data: { sessionId: f.id, tokenHash: tokenHash(newToken()), expiresAt: new Date(Date.now() + 86400_000) } });
  return { hostToken, active, completed, financial, unknownPurchaseId: unknown.id };
}
/** Hash only explicit non-secret logical state. IDs/counts, never authored secrets or credentials. */
export async function logicalSnapshot(client: PrismaClient = db()) {
  const sessions = await client.gameSession.findMany({ orderBy: { id: "asc" }, select: { id: true, hostId: true, gameTypeId: true, status: true, stateVersion: true, creditConsumedAt: true, startedAt: true, endedAt: true, currentRoundNumber: true, state: true } });
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const snapshots = await Promise.all([
    client.socialRound.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, wordSnapshot: true, alternativesSnapshot: true } }),
    client.letterQuestionUse.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, questionId: true, matchNumber: true, cellId: true, questionSnapshot: true, answerSnapshot: true, alternativesSnapshot: true } }),
    client.surveyQuestionUse.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, snapshot: true } }),
    client.forbiddenWordCardUse.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, snapshot: true } }),
    client.bluffRound.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, snapshot: true } }),
    client.rankedListUse.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, snapshot: true } }),
    client.lightningQuestionUse.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, snapshot: true } }),
    client.orderingQuestionUse.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, snapshot: true } }),
    client.courtRound.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, snapshot: true } }),
  ]);
  const models = ["SocialRound", "LetterQuestionUse", "SurveyQuestionUse", "ForbiddenWordCardUse", "BluffRound", "RankedListUse", "LightningQuestionUse", "OrderingQuestionUse", "CourtRound"];
  return {
    users: await client.user.findMany({ orderBy: { id: "asc" }, select: { id: true, role: true, suspendedAt: true } }),
    wallets: await client.creditWallet.findMany({ orderBy: { userId: "asc" }, select: { userId: true, balance: true } }),
    purchases: await client.purchase.findMany({ orderBy: { id: "asc" }, select: { id: true, userId: true, status: true, amountHalalas: true, credits: true, couponReserved: true, provider: true, providerReference: true, invoiceCreationState: true, invoiceCreationAttemptAt: true, nextReconcileAt: true, reconcileAttemptCount: true, reconcileLeaseId: true, paidAt: true } }),
    refunds: await client.purchaseRefund.findMany({ orderBy: { id: "asc" } }),
    events: await client.paymentEvent.findMany({ orderBy: { id: "asc" } }),
    ledger: await client.gameCredit.findMany({ orderBy: { id: "asc" } }),
    coupons: await client.coupon.findMany({ orderBy: { id: "asc" }, select: { id: true, usedCount: true, reservedCount: true, maxUses: true } }),
    sessions: sessions.map(({ state, ...s }) => { const x = state as Record<string, Prisma.JsonValue>; return { ...s, stateDigest: hash(state), phase: x.phase, matchNumber: x.matchNumber, roundIndex: x.roundIndex, deadlineAt: x.deadlineAt, scores: x.scores, winner: x.winner, winnerTeamId: x.winnerTeamId, roundIds: x.roundIds, useIds: x.useIds, teamIds: x.teamIds, completed: x.completed }; }),
    // Hash synthetic authoritative content internally; never emit its plaintext or any credential hash.
    snapshots: snapshots.flatMap((rows, i) => rows.map(({ id, sessionId, ...payload }) => ({ model: models[i], id, sessionId, digest: hash(payload) }))),
    teams: await client.team.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, score: true, position: true } }),
    commands: await client.gameCommand.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, key: true, type: true, stateVersion: true } }),
    scoreEvents: await client.scoreEvent.findMany({ orderBy: { id: "asc" } }),
    socialRounds: await client.socialRound.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, number: true, secretWordId: true, winner: true, snapshotOrigin: true, outsiderId: true, suspectedId: true, endedAt: true } }),
    votes: await client.socialVote.findMany({ orderBy: { id: "asc" }, select: { id: true, roundId: true, ballot: true, createdAt: true } }),
    courtRounds: await client.courtRound.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, number: true, matchNumber: true, caseId: true } }),
    auth: await client.authSession.findMany({ orderBy: { id: "asc" }, select: { id: true, userId: true, expiresAt: true, revokedAt: true } }),
    rooms: await client.room.findMany({ orderBy: { id: "asc" }, select: { id: true, sessionId: true, hostId: true, expiresAt: true } }),
  };
}
