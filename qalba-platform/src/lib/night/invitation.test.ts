import { describe, expect, it } from "vitest";
import { digestCapability, invitationResponse, inviteCodePattern, inviteInputSchema,
  MAX_INVITE_ATTENDEES, normalizeAttendeeName, rsvpInputSchema, validateSchedule, validVote } from "./invitation";
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
