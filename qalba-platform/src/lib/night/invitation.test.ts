import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { digestCapability, invitationResponse, inviteCodePattern, inviteInputSchema,
  MAX_INVITE_ATTENDEES, normalizeAttendeeName, rsvpInputSchema, validateSchedule, validVote } from "./invitation";
import { createInvitation, respondToInvitation } from "./invitation-service";
const serviceDb = vi.hoisted(() => ({ transaction: vi.fn(), findInvitation: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: () => ({
  $transaction: serviceDb.transaction,
  nightInvitation: { findUnique: serviceDb.findInvitation },
}) }));
const now = new Date("2026-10-15T12:00:00.000Z");
describe("Night planning invite: strict private RSVP contracts", () => {
  it("bounds the event schedule to 15 minutes–90 days and checks real time zones", () => {
    expect(validateSchedule({ scheduledAt: "2026-10-15T12:15:00.000Z", timezone: "Asia/Riyadh" }, now).toISOString())
      .toBe("2026-10-15T12:15:00.000Z");
    expect(() => validateSchedule({ scheduledAt: "2026-10-15T12:14:59.999Z", timezone: "Asia/Riyadh" }, now)).toThrow();
    expect(() => validateSchedule({ scheduledAt: "2027-10-15T12:00:00.000Z", timezone: "Asia/Riyadh" }, now)).toThrow();
    expect(() => validateSchedule({ scheduledAt: "2026-10-16T12:00:00.000Z", timezone: "not/a-zone" }, now)).toThrow();
    expect(inviteInputSchema.safeParse({ scheduledAt: "tomorrow", timezone: "Asia/Riyadh" }).success).toBe(false);
    expect(inviteInputSchema.safeParse({ scheduledAt: "2026-10-16T12:00:00Z", timezone: "Asia/Riyadh", paid: true }).success).toBe(false);
  });
  it("uses a 256-bit random invitation code shape and hashes it instead of storing the bearer", () => {
    const code = "a".repeat(64);
    expect(inviteCodePattern.test(code)).toBe(true);
    expect(inviteCodePattern.test("a".repeat(32))).toBe(false);
    expect(digestCapability(code)).toHaveLength(64);
    expect(digestCapability(code)).not.toBe(code);
  });
  it("rejects control/bidi characters, invalid names, unknown games and injected data", () => {
    expect(normalizeAttendeeName("  نواف  أحمد  ")).toEqual({ display: "نواف أحمد", key: "نواف أحمد" });
    expect(() => normalizeAttendeeName("x\ny")).toThrow();
    expect(() => normalizeAttendeeName("xx\u202eyy")).toThrow();
    expect(() => normalizeAttendeeName("x")).toThrow();
    expect(rsvpInputSchema.safeParse({ name: "ناصر", rsvp: "YES", gameVote: "not-launch" }).success).toBe(false);
    expect(rsvpInputSchema.safeParse({ name: "ناصر", rsvp: "YES", gameVote: null, host: true }).success).toBe(false);
    expect(() => validVote("top-list", ["top-list", "survey-show"], "YES")).not.toThrow();
    expect(() => validVote("top-list", ["survey-show"], "YES")).toThrow();
    expect(() => validVote("survey-show", ["survey-show"], "NO")).toThrow();
    expect(MAX_INVITE_ATTENDEES).toBe(32);
  });
  it.each([["ＡＬＩ", "ALI", "ali"], ["ﺃﺣﻤﺪ", "أحمد", "أحمد"]])("normalizes compatibility alias %s before enforcing uniqueness", (input, display, key) => {
    expect(normalizeAttendeeName(input)).toEqual({ display, key });
  });
  it.each(["guest\ud800", "İ".repeat(60)])("rejects aliases that cannot form a valid bounded database key", name => {
    expect(() => normalizeAttendeeName(name)).toThrow();
  });
  it.each([
    { scheduledAt: "2026-10-16T12:00:00Z", timezone: "+03:00" },
    { scheduledAt: "2026-10-16", timezone: "Asia/Riyadh" },
    { scheduledAt: "2026-10-16T12:00:00Z", timezone: "Asia/Riyadh", host: true },
  ])("rejects offset-only zones and malformed direct-service schedules: %j", input => {
    expect(() => validateSchedule(input, now)).toThrow();
  });
  it("projects totals and votes without exposing names, capabilities, private results or source IDs", () => {
    const view = invitationResponse({
      scheduledAt: new Date("2026-10-17T18:00:00Z"), timezone: "Asia/Riyadh",
      expiresAt: new Date("2026-10-18T18:00:00Z"), status: "open", nightPhase: "preparing",
      games: [{ gameSlug: "top-list" }, { gameSlug: "ordering-challenge" }, { gameSlug: "survey-show" }],
      guests: [{ rsvp: "YES", gameVote: "top-list" }, { rsvp: "NO", gameVote: null },
        { rsvp: "YES", gameVote: "top-list" }],
      mine: { name: "نواف", rsvp: "YES", gameVote: "top-list" },
    }, now);
    expect(view).toMatchObject({ open: true, coming: 2, declined: 1, mine: { name: "نواف" } });
    expect(view.games.find(g => g.game === "top-list")?.votes).toBe(2);
    expect(JSON.stringify(view)).not.toContain("capabilityHash");
    expect(JSON.stringify(view)).not.toContain("sourceSessionId");
    expect(invitationResponse({
      scheduledAt: now, timezone: "Asia/Riyadh", expiresAt: new Date(now.getTime() + 86400_000),
      status: "open", nightPhase: "playing", games: [], guests: [],
    }, now).open).toBe(false);
  });
});

describe("Night invitation service validation and replay boundaries", () => {
  beforeEach(() => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true");
    serviceDb.transaction.mockReset(); serviceDb.findInvitation.mockReset();
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
  it("rechecks the minimum schedule after the Night lock has been acquired", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    serviceDb.transaction.mockImplementation(async callback => callback({
      $queryRawUnsafe: vi.fn(async () => { vi.setSystemTime(new Date(now.getTime() + 1)); }),
      nightSession: { findUnique: vi.fn(async () => ({ ownerId: "owner", phase: "preparing" })) },
      nightInvitation: { findUnique: vi.fn(async () => null), create: vi.fn(async ({ data }) => data) },
    }));
    let rejected = false;
    try { await createInvitation("owner", "night", { scheduledAt: "2026-10-15T12:15:00Z", timezone: "Asia/Riyadh" }); }
    catch (error) { expect(error).toMatchObject({ status: 400 }); rejected = true; }
    expect(rejected).toBe(true);
  });
  it("rejects injected direct-service RSVP fields before any database access", async () => {
    await expect(respondToInvitation("a".repeat(64), {
      name: "ضيف تجريبي", rsvp: "YES", gameVote: null, host: true,
    } as Parameters<typeof respondToInvitation>[1])).rejects.toMatchObject({ status: 400 });
    expect(serviceDb.findInvitation).not.toHaveBeenCalled();
  });
  function replayFixture(phase = "preparing", expiresAt = new Date(now.getTime() + 60_000)) {
    const capability = "b".repeat(64);
    const current = {
      id: "invitation", nightId: "night", status: "open", scheduledAt: now, timezone: "Asia/Riyadh", expiresAt,
      rateCount: 60, rateWindowAt: now,
      night: { phase, games: [{ gameSlug: "top-list" }] },
      guests: [{ capabilityHash: digestCapability(capability), name: "ضيف تجريبي", nameKey: "ضيف تجريبي", rsvp: "YES", gameVote: "top-list" }],
    };
    const update = vi.fn();
    serviceDb.findInvitation.mockResolvedValue({ id: current.id, nightId: current.nightId });
    serviceDb.transaction.mockImplementation(async callback => callback({
      $queryRawUnsafe: vi.fn(),
      nightInvitation: { findUnique: vi.fn(async () => current), update },
      nightInviteGuest: { update, create: update },
    }));
    return { capability, update };
  }
  it("recovers a lost accepted response at the mutation limit without another write or vote", async () => {
    const { capability, update } = replayFixture();
    const saved = await respondToInvitation("a".repeat(64), { name: "ضيف تجريبي", rsvp: "YES", gameVote: "top-list" }, capability, now);
    expect(saved.view).toMatchObject({ coming: 1, declined: 0, mine: { name: "ضيف تجريبي" } });
    expect(update).not.toHaveBeenCalled();
  });
  it.each(["playing", "ended"])("does not let identical replay bypass the closed Night phase %s", async phase => {
    const { capability } = replayFixture(phase);
    await expect(respondToInvitation("a".repeat(64), { name: "ضيف تجريبي", rsvp: "YES", gameVote: "top-list" }, capability, now))
      .rejects.toMatchObject({ status: 409 });
  });
  it("does not let identical replay bypass the exact expiry boundary", async () => {
    const { capability } = replayFixture("preparing", now);
    await expect(respondToInvitation("a".repeat(64), { name: "ضيف تجريبي", rsvp: "YES", gameVote: "top-list" }, capability, now))
      .rejects.toMatchObject({ status: 409 });
  });
});
