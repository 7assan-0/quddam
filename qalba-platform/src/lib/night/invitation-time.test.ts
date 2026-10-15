import { describe, expect, it } from "vitest";
import { invitationLocalInstant } from "./invitation-time";

describe("invitation local schedule interpretation", () => {
  it("resolves the displayed IANA zone independently of the server's zone", () => {
    expect(invitationLocalInstant("2026-11-01T18:30", "Asia/Riyadh")).toBe("2026-11-01T15:30:00.000Z");
    expect(invitationLocalInstant("2026-06-01T20:15", "America/New_York")).toBe("2026-06-02T00:15:00.000Z");
    expect(invitationLocalInstant("2026-11-01T18:30", "Asia/Kathmandu")).toBe("2026-11-01T12:45:00.000Z");
  });
  it("rejects nonexistent daylight-saving wall times instead of silently shifting them", () => {
    expect(invitationLocalInstant("2027-03-14T02:30", "America/New_York")).toBeNull();
    expect(invitationLocalInstant("2027-03-28T01:30", "Europe/London")).toBeNull();
  });
  it("rejects duplicated daylight-saving wall times rather than choosing an unconfirmed instant", () => {
    expect(invitationLocalInstant("2026-11-01T01:30", "America/New_York")).toBeNull();
    expect(invitationLocalInstant("2026-10-25T01:30", "Europe/London")).toBeNull();
  });
  it.each(["", "2026-02-30T18:00", "2026-13-01T18:00", "2026-11-01T24:00", "2026-11-01T18:00Z", "2026-11-01"])("rejects invalid wall time %s", local => {
    expect(invitationLocalInstant(local, "Asia/Riyadh")).toBeNull();
  });
  it("rejects invalid and numeric-offset zone identifiers", () => {
    expect(invitationLocalInstant("2026-11-01T18:00", "invalid/zone")).toBeNull();
    expect(invitationLocalInstant("2026-11-01T18:00", "+03:00")).toBeNull();
  });
});
