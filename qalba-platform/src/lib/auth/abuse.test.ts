import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authBudget, authClientIdentity } from "./abuse";
import { publicWelcomeCreditsEnabled } from "./welcome-policy";

function request(address = "203.0.113.20", extra: HeadersInit = {}) {
  return new Request("http://localhost", { headers: { "x-quddam-client-ip": address, ...extra } });
}
describe("trusted auth client identity and budget privacy", () => {
  beforeEach(() => { vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "test-only-hmac-secret-at-least-24-characters");
    vi.stubEnv("AUTH_TRUST_PROXY", "true"); vi.stubEnv("AUTH_CLIENT_IP_HEADER", "x-quddam-client-ip"); });
  afterEach(() => vi.unstubAllEnvs());
  it("ignores spoofable forwarding/custom headers by default", () => {
    vi.stubEnv("AUTH_TRUST_PROXY", "false");
    expect(authClientIdentity(request("203.0.113.1", { "x-forwarded-for": "victim" }))).toBe("unknown");
    expect(authBudget(request("203.0.113.1"), "test@example.test", "register")).toEqual(authBudget(request("203.0.113.2"), "test@example.test", "register"));
  });
  it("accepts only the configured overwritten header and separates normal IPv4 clients", () => {
    expect(authClientIdentity(request())).toBe("ipv4:203.0.113.20");
    expect(authClientIdentity(request("203.0.113.21", { "x-forwarded-for": "203.0.113.20" }))).toBe("ipv4:203.0.113.21");
  });
  it.each(["", "203.0.113.20, 203.0.113.21", "203.0.113.20:80", "not-an-ip", "fe80::1%eth0"])("fails safely to the unknown budget for %s", address => {
    expect(authClientIdentity(request(address))).toBe("unknown");
  });
  it("normalizes IPv4-mapped spelling and IPv6 /64 temporary addresses", () => {
    expect(authClientIdentity(request("::ffff:203.0.113.20"))).toBe(authClientIdentity(request("203.0.113.20")));
    expect(authClientIdentity(request("2001:db8:0001:0002::1"))).toBe(authClientIdentity(request("2001:db8:1:2:ffff::7")));
    expect(authClientIdentity(request("2001:db8:1:3::1"))).not.toBe(authClientIdentity(request("2001:db8:1:2::1")));
  });
  it("requires explicit valid proxy configuration and a long stable HMAC secret", () => {
    vi.stubEnv("AUTH_CLIENT_IP_HEADER", ""); expect(() => authClientIdentity(request())).toThrow("AUTH_CLIENT_IP_HEADER");
    vi.stubEnv("AUTH_CLIENT_IP_HEADER", "x-quddam-client-ip"); vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "short");
    expect(() => authBudget(request(), "person@example.test", "register")).toThrow("AUTH_RATE_LIMIT_SECRET");
  });
  it("persists only secret-HMAC keys and keeps login victim identities isolated by client", () => {
    const a = authBudget(request(), "Victim@example.test", "login"), b = authBudget(request("203.0.113.21"), "victim@example.test", "login");
    for (const rule of a) expect(rule.key).toMatch(/^[a-f0-9]{64}$/);
    expect(a.filter(x => x.scope === "email-client").map(x => x.key)).not.toEqual(b.filter(x => x.scope === "email-client").map(x => x.key));
    expect(JSON.stringify(a)).not.toMatch(/Victim|example.test|203\.0\.113/);
  });
});
describe("explicit public welcome eligibility", () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each([undefined, "false"])("is disabled for %s", value => { vi.stubEnv("PUBLIC_WELCOME_CREDITS_ENABLED", value); expect(publicWelcomeCreditsEnabled()).toBe(false); });
  it("requires explicit true and rejects accidental invalid configuration", () => {
    vi.stubEnv("PUBLIC_WELCOME_CREDITS_ENABLED", "true"); expect(publicWelcomeCreditsEnabled()).toBe(true);
    vi.stubEnv("PUBLIC_WELCOME_CREDITS_ENABLED", "yes"); expect(() => publicWelcomeCreditsEnabled()).toThrow("PUBLIC_WELCOME_CREDITS_ENABLED");
  });
});
