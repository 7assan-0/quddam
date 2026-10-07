import { expect, it } from "vitest";
import { decodeRetentionCursor, encodeRetentionCursor, historicalSocialVoteCount, retiredCredential, retentionBatchSize, retentionCutoffs, RETENTION_KINDS } from "./policy";
import { tokenHash } from "@/lib/auth/crypto";
import { retentionEligibilitySql } from "./service";

it("calculates exact UTC cutoffs without mutating the clock", () => {
  const now = new Date("2026-10-06T12:34:56.789Z"), c = retentionCutoffs(now);
  expect(c.auth.toISOString()).toBe("2026-09-06T12:34:56.789Z");
  expect(c.reset.toISOString()).toBe("2026-09-29T12:34:56.789Z");
  expect(c.access).toEqual(c.auth); expect(c.privateVote).toEqual(c.analytics);
  expect(c.analytics.toISOString()).toBe("2026-07-08T12:34:56.789Z");
  expect(c.abuse.toISOString()).toBe("2026-10-04T12:34:56.789Z");
  expect(now.toISOString()).toBe("2026-10-06T12:34:56.789Z");
  expect(() => retentionCutoffs(new Date(NaN))).toThrow();
});
it("bounds the invocation budget, including invalid numbers", () => {
  expect(retentionBatchSize()).toBe(100); expect(retentionBatchSize(1)).toBe(1); expect(retentionBatchSize(500)).toBe(500);
  for (const size of [0, -1, 501, 1.5, NaN, Infinity]) expect(() => retentionBatchSize(size)).toThrow();
});
it("round-trips stable chronological cursor metadata and rejects malformed values", () => {
  const c = { eligibleAt: "2026-01-01T00:00:00.000Z", kind: "SocialVote" as const, id: "internal-row" };
  expect(decodeRetentionCursor(encodeRetentionCursor(c))).toEqual(c); expect(decodeRetentionCursor()).toBeNull();
  for (const bad of ["%%%", "a".repeat(1025), Buffer.from(JSON.stringify({ ...c, kind: "Purchase" })).toString("base64url"), Buffer.from(JSON.stringify({ ...c, eligibleAt: "yesterday" })).toString("base64url")]) expect(() => decodeRetentionCursor(bad)).toThrow();
});
it("irreversible credential markers are unique, stable and outside the token hash range", () => {
  const mark = retiredCredential("CourtParticipant", "row");
  expect(mark).toHaveLength(64); expect(mark).not.toMatch(/^[0-9a-f]{64}$/);
  expect(mark).toBe(retiredCredential("CourtParticipant", "row"));
  expect(mark).not.toBe(retiredCredential("SocialParticipant", "row"));
  expect(mark).not.toBe(retiredCredential("CourtParticipant", "other"));
  expect(mark).not.toBe(tokenHash(mark));
});
it("preserves historical vote counts during partial and complete redaction", () => {
  expect(historicalSocialVoteCount(2, { 1: 3, 2: 5 }, 1)).toBe(5);
  expect(historicalSocialVoteCount(0, { 1: 5 }, 1)).toBe(5);
  for (const invalid of [null, undefined, [], { 1: -5 }, { 1: "secret" }, { 1: 1.5 }]) expect(historicalSocialVoteCount(2, invalid, 1)).toBe(2);
});
it("excludes every financial model and command/score receipts from destructive policy", () => {
  for (const retained of ["Purchase", "PurchaseRefund", "PaymentEvent", "GameCredit", "CreditWallet", "Coupon", "GameCommand", "ScoreEvent", "LetterQuestionUse", "SurveyQuestionUse", "RankedListUse"]) expect(RETENTION_KINDS).not.toContain(retained);
  expect(retentionEligibilitySql()).toContain("NOT LIKE 'PURCHASE_%'");
});
it("requires terminal parent lifecycle for gameplay access/private detail and keeps live blocks", () => {
  const sql = retentionEligibilitySql();
  expect(sql).toContain("'COMPLETED','ABANDONED'"); expect(sql).toContain('s."endedAt" IS NOT NULL');
  expect(sql).toContain('r."expiresAt" < $3'); expect(sql).toContain('a."blockedUntil" < $7');
  expect(sql).not.toContain('SELECT p."tokenHash"'); expect(sql).not.toContain('SELECT v."choice"');
});
