import { describe, expect, it } from "vitest";
import { remainingOnClient, serverOffsetMs } from "./clock";
import { displayAccessValid, DISPLAY_COMPLETED_GRACE_MS } from "./display-access";
import { displayWindowEndsAt } from "./display-policy";

describe("server timer synchronization", () => {
  it("keeps host and TV aligned despite clocks ten minutes apart", () => {
    const server = "2026-01-01T00:00:00.000Z";
    const deadline = "2026-01-01T00:00:30.000Z";
    const hostClock = Date.parse(server) + 600_000;
    const tvClock = Date.parse(server) - 600_000;
    const host = remainingOnClient(deadline, 30_000, hostClock, serverOffsetMs(server, hostClock));
    const tv = remainingOnClient(deadline, 30_000, tvClock, serverOffsetMs(server, tvClock));
    expect(host).toBe(30_000);
    expect(tv).toBe(host);
  });
  it("uses the stored duration while paused and accounts for half of network latency", () => {
    expect(remainingOnClient(null, 18_000, Date.now(), 600_000)).toBe(18_000);
    expect(serverOffsetMs("2026-01-01T00:00:00.000Z", 1200, 1000)).toBe(Date.parse("2026-01-01T00:00:00.000Z") - 1100);
  });
});

describe("read-only display access policy", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const valid = { expiresAt: new Date(now.getTime() + 10_000), revokedAt: null };
  it("expires or revokes a token", () => {
    expect(displayAccessValid(valid, { endedAt: null }, now)).toBe(true);
    expect(displayAccessValid({ ...valid, expiresAt: now }, { endedAt: null }, now)).toBe(false);
    expect(displayAccessValid({ ...valid, revokedAt: now }, { endedAt: null }, now)).toBe(false);
  });
  it("expires access to completed games after the configured grace period", () => {
    const long = { ...valid, expiresAt: new Date(now.getTime() + DISPLAY_COMPLETED_GRACE_MS * 2) };
    expect(displayAccessValid(long, { endedAt: new Date(now.getTime() - DISPLAY_COMPLETED_GRACE_MS) }, now)).toBe(false);
    expect(displayWindowEndsAt(new Date(now.getTime() - DISPLAY_COMPLETED_GRACE_MS), now)).toBeNull();
    expect(displayWindowEndsAt(new Date(now.getTime() - 1000), now)?.getTime()).toBe(now.getTime() + DISPLAY_COMPLETED_GRACE_MS - 1000);
  });
});
