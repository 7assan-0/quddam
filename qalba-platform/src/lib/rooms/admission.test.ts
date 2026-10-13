import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { JOIN_ADMISSION_LIMITS, consumeJoinAdmission, joinAdmissionBudget, joinAdmissionTarget } from "./admission";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
const secret = "synthetic-guest-join-hmac-secret-at-least-32";
const request = (client = "203.0.113.20", extra: HeadersInit = {}) =>
  new Request("https://quddam.test/api/join", { headers: { "x-quddam-client-ip": client, ...extra } });
const keys = (kind: "board" | "social" | "court" | "bluff", target: string, address = "203.0.113.20") =>
  joinAdmissionBudget(request(address), kind, target);
const ofScope = (budget: ReturnType<typeof keys>, scope: string) =>
  budget.filter(item => item.scope === scope).map(item => item.key);

describe("layered guest-join admission identities", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", secret);
    vi.stubEnv("AUTH_TRUST_PROXY", "true");
    vi.stubEnv("AUTH_CLIENT_IP_HEADER", "x-quddam-client-ip");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("canonicalizes Board aliases before constructing every room-scoped key", () => {
    expect(joinAdmissionTarget("board", " 7k4p2q ")).toBe("7K4P2Q");
    expect(keys("board", " 7k4p2q ")).toEqual(keys("board", "7K4P2Q"));
    expect(joinAdmissionTarget("board", "0I1O6S")).toBe("invalid");
    expect(keys("board", "bad!")).toEqual(keys("board", "another-invalid"));
  });
  it("canonicalizes UUID case, bounds invalid subjects and isolates game kinds", () => {
    const id = "315afc1d-3444-4d72-aabc-8f1314112a9e";
    expect(keys("court", id.toUpperCase())).toEqual(keys("court", id));
    expect(keys("bluff", "invalid-1")).toEqual(keys("bluff", "invalid-2"));
    expect(ofScope(keys("court", id), "room")).not.toEqual(ofScope(keys("bluff", id), "room"));
  });
  it("shares global/client budgets across all games and rooms", () => {
    const a = keys("board", "7K4P2Q"), b = keys("social", "315afc1d-3444-4d72-aabc-8f1314112a9e");
    for (const scope of ["client", "global"]) expect(ofScope(a, scope)).toEqual(ofScope(b, scope));
    expect(ofScope(a, "room")).not.toEqual(ofScope(b, "room"));
    expect(ofScope(a, "room-client")).not.toEqual(ofScope(b, "room-client"));
    expect(JOIN_ADMISSION_LIMITS).toHaveLength(6);
  });
  it("ignores forged forwarding chains and normalizes mapped IPv4 and IPv6 /64", () => {
    const forged = request("203.0.113.20", { "x-forwarded-for": "198.51.100.1, 198.51.100.2" });
    expect(joinAdmissionBudget(forged, "board", "7K4P2Q")).toEqual(keys("board", "7K4P2Q"));
    expect(keys("board", "7K4P2Q", "::ffff:203.0.113.20")).toEqual(keys("board", "7K4P2Q"));
    expect(keys("board", "7K4P2Q", "2001:db8:1:2::1")).toEqual(keys("board", "7K4P2Q", "2001:db8:1:2:ffff::7"));
    expect(ofScope(keys("board", "7K4P2Q", "203.0.113.21"), "client"))
      .not.toEqual(ofScope(keys("board", "7K4P2Q"), "client"));
  });
  it("fails to one unknown-client bucket without trusted proxy or on malformed header", () => {
    vi.stubEnv("AUTH_TRUST_PROXY", "false");
    expect(keys("board", "7K4P2Q", "203.0.113.1")).toEqual(keys("board", "7K4P2Q", "203.0.113.2"));
    vi.stubEnv("AUTH_TRUST_PROXY", "true");
    expect(keys("board", "7K4P2Q", "bad-ip")).toEqual(keys("board", "7K4P2Q", "203.0.113.1, 203.0.113.2"));
  });
  it("persists only pseudonymous keys, and refuses missing secrets or proxy misconfiguration", () => {
    const budget = keys("board", "7K4P2Q");
    expect(budget.every(item => /^[a-f0-9]{64}$/.test(item.key))).toBe(true);
    expect(JSON.stringify(budget)).not.toMatch(/203\\.0\\.113|7K4P2Q|quddam-client-ip/);
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "short");
    expect(() => keys("board", "7K4P2Q")).toThrow("AUTH_RATE_LIMIT_SECRET");
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", secret); vi.stubEnv("AUTH_CLIENT_IP_HEADER", "");
    expect(() => keys("board", "7K4P2Q")).toThrow("AUTH_CLIENT_IP_HEADER");
  });
});

describe("atomic admission behavior", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", secret);
    vi.stubEnv("AUTH_TRUST_PROXY", "true");
    vi.stubEnv("AUTH_CLIENT_IP_HEADER", "x-quddam-client-ip");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
  function mockDatabase(query: ReturnType<typeof vi.fn>) {
    const transaction = vi.fn(async (work: (tx: { $queryRaw: typeof query }) => Promise<void>) => work({ $queryRaw: query }));
    const prune = vi.fn(async () => 0);
    vi.mocked(db).mockReturnValue({ $transaction: transaction, $executeRaw: prune } as never);
    return { transaction, prune };
  }
  it("admits six layers in deterministic order within one transaction", async () => {
    const query = vi.fn(async () => [{ count: 1 }]), database = mockDatabase(query);
    expect(await consumeJoinAdmission(request(), "board", " 7k4p2q ")).toBe(true);
    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(6);
    expect(database.prune).toHaveBeenCalledTimes(1);
    expect(JOIN_ADMISSION_LIMITS.every(limit => limit.count > 0 && limit.milliseconds > 0)).toBe(true);
  });
  it("rejects any exhausted layer and propagates database failures (never fail-open)", async () => {
    let call = 0;
    const query = vi.fn(async () => ++call === 3 ? [] : [{ count: 1 }]);
    mockDatabase(query);
    expect(await consumeJoinAdmission(request(), "court", "315afc1d-3444-4d72-aabc-8f1314112a9e")).toBe(false);
    expect(query).toHaveBeenCalledTimes(3);
    query.mockRejectedValue(new Error("database offline"));
    await expect(consumeJoinAdmission(request(), "board", "7K4P2Q")).rejects.toThrow("database offline");
  });
});
