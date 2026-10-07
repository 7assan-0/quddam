import { describe, expect, it } from "vitest";
import { displayWatchFinished, displayAccessValid, DISPLAY_COMPLETED_GRACE_MS } from "@/lib/games/category-board/display-policy";
import { remainingOnClient, serverOffsetMs } from "@/lib/games/category-board/clock";
import { boardPhoneResponseOpen } from "@/lib/rooms/board-response-policy";
import type { ActiveQuestion } from "@/lib/games/category-board/module";
import { couponPrice } from "@/lib/billing/coupon-eligibility";
import { analyticsSince, saudiDate, saudiDayStart, sessionHistorySummary } from "@/lib/admin/metric-policy";
import { productionEnvironment } from "@/lib/operations/environment";

const now = new Date("2026-10-06T21:00:00Z");
const active: ActiveQuestion = { cellKey: "c", questionId: "q", originalTeamId: "a", answeringTeamId: "a", phase: "QUESTION", revealed: false, double: false, shield: false, removedOptions: [], remainingMs: 30_000, deadlineAt: null };
describe("L01 reopen-aware Board display", () => {
  it.each(["IN_PROGRESS", "PAUSED", "LOBBY"])("keeps %s observable", status => expect(displayWatchFinished({ status, canUndo: false })).toBe(false));
  it("keeps a final score judgment observable for Undo", () => expect(displayWatchFinished({ status: "COMPLETED", canUndo: true })).toBe(false));
  it.each(["COMPLETED", "ABANDONED"])("closes a %s state that cannot be undone", status => expect(displayWatchFinished({ status, canUndo: false })).toBe(true));
  it("grace window is finite and reopening clears the terminal boundary", () => {
    const access = { revokedAt: null, expiresAt: new Date(now.getTime() + 10 * DISPLAY_COMPLETED_GRACE_MS) };
    expect(displayAccessValid(access, { endedAt: now }, new Date(now.getTime() + DISPLAY_COMPLETED_GRACE_MS))).toBe(false);
    expect(displayAccessValid(access, { endedAt: null }, new Date(now.getTime() + DISPLAY_COMPLETED_GRACE_MS))).toBe(true);
  });
});
describe("L03 locked coupon eligibility", () => {
  const coupon = { active: true, expiresAt: null, maxUses: 1, usedCount: 0, reservedCount: 0, discountPercent: 10, discountHalalas: null };
  it("preserves the configured discount", () => expect(couponPrice(coupon, 1500, now)).toBe(1350));
  it("rejects the authoritative inactive row", () => expect(() => couponPrice({ ...coupon, active: false }, 1500, now)).toThrow());
  it("expiry equality is not eligible", () => expect(() => couponPrice({ ...coupon, expiresAt: now }, 1500, now)).toThrow());
  it.each([{ usedCount: 1, reservedCount: 0 }, { usedCount: 0, reservedCount: 1 }])("counts used and reserved capacity %j", counts => expect(() => couponPrice({ ...coupon, ...counts }, 1500, now)).toThrow());
  it("retains unlimited nullable maxUses semantics", () => expect(couponPrice({ ...coupon, maxUses: null, usedCount: 100, reservedCount: 100 }, 1500, now)).toBe(1350));
  it("keeps the existing one-riyal price floor", () => expect(() => couponPrice({ ...coupon, discountPercent: 100 }, 1500, now)).toThrow());
});
describe("L06 deadline-authoritative phone boundary", () => {
  it("permits a deliberately untimed open question", () => expect(boardPhoneResponseOpen("IN_PROGRESS", { active }, now)).toBe(true));
  it("accepts before a deadline", () => expect(boardPhoneResponseOpen("IN_PROGRESS", { active: { ...active, deadlineAt: new Date(now.getTime() + 1).toISOString() } }, now)).toBe(true));
  it.each([0, -1])("rejects at/after deadline offset %s", offset => expect(boardPhoneResponseOpen("IN_PROGRESS", { active: { ...active, deadlineAt: new Date(now.getTime() + offset).toISOString() } }, now)).toBe(false));
  it.each(["PAUSED", "COMPLETED", "LOBBY"])("rejects %s", status => expect(boardPhoneResponseOpen(status, { active }, now)).toBe(false));
  it("rejects reveal, challenge and paused-expired remaining duration", () => {
    for (const patch of [{ revealed: true }, { phase: "CHALLENGE" as const }, { remainingMs: 0 }]) expect(boardPhoneResponseOpen("IN_PROGRESS", { active: { ...active, ...patch } }, now)).toBe(false);
  });
  it.each([-120_000, 120_000])("clock offset %s leaves the server countdown unchanged", skew => {
    const local = now.getTime() + skew, offset = serverOffsetMs(now.toISOString(), local);
    expect(remainingOnClient(new Date(now.getTime() + 15_000).toISOString(), 30_000, local, offset)).toBe(15_000);
  });
  it("paused time remains frozen; expired deadline clamps at zero", () => {
    expect(remainingOnClient(null, 12000, now.getTime() + 60000, 0)).toBe(12000);
    expect(remainingOnClient(now.toISOString(), 30000, now.getTime() + 1000, 0)).toBe(0);
  });
});
describe("L04 metric/history definitions", () => {
  it("uses Saudi calendar midnight and an exact rolling 30-day duration", () => {
    expect(saudiDayStart(now).toISOString()).toBe(now.toISOString());
    expect(saudiDayStart(new Date(now.getTime() - 1)).toISOString()).toBe("2026-10-05T21:00:00.000Z");
    expect(now.getTime() - analyticsSince(now).getTime()).toBe(30 * 86400_000);
    expect(saudiDate(now)).toBe(saudiDate(new Date("2026-10-07T00:00:00+03:00")));
  });
  const base = { gameType: { slug: "letter-network" }, currentRoundNumber: 1, teams: [{ id: "a", name: "أ", score: 0, position: 0 }, { id: "b", name: "ب", score: 0, position: 1 }] };
  it("Letter history counts captured cells from the current durable board", () => expect(sessionHistorySummary({ ...base, state: { matchNumber: 2, board: [{ ownerTeamId: "a" }, { ownerTeamId: "a" }, { ownerTeamId: "b" }] } })).toEqual({ match: 2, text: "أ 2 خلية — ب 1 خلية" }));
  it("Bluff history uses participant scores, not empty teams", () => expect(sessionHistorySummary({ ...base, teams: [], state: { module: "BLUFF_GAME", matchNumber: 2 }, bluffParticipants: [{ name: "أ", score: 3, position: 0 }, { name: "ب", score: 5, position: 1 }] }).text).toBe("ب 5 — أ 3"));
  it("Social summary exposes the result without a secret or outsider identity", () => {
    const summary = sessionHistorySummary({ ...base, gameType: { slug: "out-of-the-loop" }, state: { winner: "OUTSIDER", phase: "COMPLETED", secret: "PRIVATE", outsiderId: "PRIVATE-ID" } });
    expect(summary.text).toBe("فاز اللاعب خارج الجو"); expect(JSON.stringify(summary)).not.toContain("PRIVATE");
  });
  it("legacy/default summaries use latest scoreboard, never old score-event totals", () => expect(sessionHistorySummary({ ...base, gameType: { slug: "party-court" }, state: {} }).text).toBe("أ 0 — ب 0"));
});
describe("L05 production environment", () => {
  const env = { DATABASE_URL: "postgresql://app@127.0.0.1/quddam", APP_URL: "https://quddam.example", AUTH_RATE_LIMIT_SECRET: "s".repeat(40), AUTH_TRUST_PROXY: "false", PUBLIC_WELCOME_CREDITS_ENABLED: "false" };
  it("allows explicitly unconfigured optional payment/mail facilities", () => { const r = productionEnvironment(env); expect(r.valid).toBe(true); expect(r.paymentConfigured).toBe(false); });
  it.each(["DATABASE_URL", "APP_URL", "AUTH_RATE_LIMIT_SECRET"])("missing %s fails without exposing values", key => { const r = productionEnvironment({ ...env, [key]: undefined }); expect(r.valid).toBe(false); expect(JSON.stringify(r)).not.toContain(env.AUTH_RATE_LIMIT_SECRET); });
  it("rejects HTTP, embedded credentials and a non-origin base URL", () => { for (const APP_URL of ["http://example.test", "https://u:p@example.test", "https://example.test/path"]) expect(productionEnvironment({ ...env, APP_URL }).valid).toBe(false); });
  it("rejects partial billing secrets and absent cron authentication", () => expect(productionEnvironment({ ...env, MOYASAR_SECRET_KEY: "fixture-key" }).valid).toBe(false));
  it("validates the complete payment configuration without printing its secrets", () => { const r = productionEnvironment({ ...env, MOYASAR_SECRET_KEY: "fixture-key", MOYASAR_CALLBACK_TOKEN: "c".repeat(40), BILLING_CRON_SECRET: "b".repeat(40) }); expect(r.valid).toBe(true); expect(r.paymentConfigured).toBe(true); expect(JSON.stringify(r)).not.toContain("fixture-key"); });
  it("requires explicit single-IP trusted-proxy configuration", () => { expect(productionEnvironment({ ...env, AUTH_TRUST_PROXY: "true" }).valid).toBe(false); expect(productionEnvironment({ ...env, AUTH_TRUST_PROXY: "true", AUTH_CLIENT_IP_HEADER: "x-client-ip" }).valid).toBe(true); });
  it.each(["0", "21", "1.5"])("rejects pool maximum %s", DATABASE_POOL_MAX => expect(productionEnvironment({ ...env, DATABASE_POOL_MAX }).valid).toBe(false));
});
