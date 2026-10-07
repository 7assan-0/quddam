import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { browserSecurityHeaders, candidateCsp, cspImageOrigins } from "@/lib/security/browser-headers";
import { productionEnvironment } from "@/lib/operations/environment";

const nonce = "aBcDeFgHiJkLmNoPqRsTuVwX";
const directives = (policy: string) => Object.fromEntries(policy.split(";").filter(s => s.trim()).map(s => { const [key, ...values] = s.trim().split(/\s+/); return [key, values]; }));
const env = { NODE_ENV: "production", APP_URL: "https://quddam.example", DATABASE_URL: "postgresql://app@127.0.0.1/quddam", AUTH_RATE_LIMIT_SECRET: "s".repeat(40) };
describe("I-1 production browser policy", () => {
  it("has explicit restrictive defaults and boundaries", () => {
    const d = directives(candidateCsp(nonce, { development: false }));
    for (const key of ["object-src", "frame-src", "frame-ancestors", "media-src", "worker-src", "script-src-attr"]) expect(d[key]).toEqual(["'none'"]);
    for (const key of ["default-src", "base-uri", "form-action", "font-src", "connect-src", "manifest-src"]) expect(d[key]).toEqual(["'self'"]);
  });
  it("uses a nonce and strict-dynamic without unsafe script allowances", () => {
    const d = directives(candidateCsp(nonce, { development: false }));
    expect(d["script-src"]).toEqual(["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]);
    expect(d["style-src-elem"]).toEqual(["'self'", `'nonce-${nonce}'`]);
    expect(d["style-src-attr"]).toEqual(["'unsafe-inline'"]);
  });
  it("has no wildcard, development origin, report-sample or unsolicited report destination", () => {
    const p = candidateCsp(nonce, { development: false, developmentOrigin: "http://localhost:3000" });
    expect(p).not.toMatch(/\*|unsafe-eval|localhost|127\.0\.0\.1|report-sample|report-uri|report-to|ws:/);
    expect(directives(p)["img-src"]).toEqual(["'self'", "data:"]);
  });
  it("isolates HMR/eval and inline style elements to development", () => {
    const d = directives(candidateCsp(nonce, { development: true, developmentOrigin: "http://localhost:3000" }));
    expect(d["script-src"]).toContain("'unsafe-eval'"); expect(d["connect-src"]).toContain("ws://localhost:3000");
    expect(d["style-src-elem"]).toContain("'unsafe-inline'");
    expect(candidateCsp(nonce, { development: false })).not.toContain("unsafe-eval");
  });
  it.each(["", "bad; default-src *", "a".repeat(200)])("rejects an invalid nonce", value => expect(() => candidateCsp(value, { development: false })).toThrow("Invalid CSP nonce"));
  it("only adds explicit optional image origins", () => {
    const origins = cspImageOrigins("https://cdn.example, https://images.example/,https://cdn.example");
    expect(origins).toEqual(["https://cdn.example", "https://images.example"]);
    const d = directives(candidateCsp(nonce, { development: false, imageOrigins: origins }));
    expect(d["img-src"]).toEqual(["'self'", "data:", ...origins]); expect(d["connect-src"]).toEqual(["'self'"]);
  });
  it.each(["*", "https:", "http://cdn.example", "https://*.example", "https://user:secret@cdn.example", "https://cdn.example/path", "https://cdn.example/?secret=x", "https://cdn.example/#x", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://cdn.example;script-src *", Array(9).fill("https://cdn.example").join(",")])("rejects unsafe origin configuration without echoing values", value => {
    expect(() => cspImageOrigins(value)).toThrow(/^Invalid CSP_IMAGE_ORIGINS$/);
    const result = productionEnvironment({ ...env, CSP_IMAGE_ORIGINS: value });
    expect(result.valid).toBe(false); expect(JSON.stringify(result)).not.toContain("secret=x");
  });
  it("keeps image configuration optional", () => { expect(cspImageOrigins()).toEqual([]); expect(productionEnvironment(env).valid).toBe(true); });
  it("applies non-isolating browser headers, no COEP", () => {
    const h = Object.fromEntries(browserSecurityHeaders(env).map(v => [v.key, v.value]));
    expect(h["X-Content-Type-Options"]).toBe("nosniff"); expect(h["Referrer-Policy"]).toBe("no-referrer");
    expect(h["X-Frame-Options"]).toBe("DENY"); expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Cross-Origin-Resource-Policy"]).toBe("same-origin"); expect(h["Cross-Origin-Embedder-Policy"]).toBeUndefined();
    expect(h["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
  });
  it("uses one year HSTS only for production canonical HTTPS, without subdomain/preload assumptions", () => {
    expect(browserSecurityHeaders(env).find(h => h.key === "Strict-Transport-Security")?.value).toBe("max-age=31536000");
    for (const e of [{ ...env, NODE_ENV: "development" }, { ...env, APP_URL: "http://localhost:3000" }, { ...env, APP_URL: "" }]) expect(browserSecurityHeaders(e).some(h => h.key === "Strict-Transport-Security")).toBe(false);
  });
  it("forwards a trusted nonce while retaining Lightning authorization and excluding API body buffering", () => {
    const source = readFileSync("src/proxy.ts", "utf8");
    expect(source).toContain('headers.delete("content-security-policy-report-only")'); expect(source).toContain('headers.set("x-nonce", nonce)');
    expect(source).toContain('headers.set("Content-Security-Policy", policy)'); expect(source).toContain('response.headers.set("Content-Security-Policy-Report-Only", policy)');
    expect(source).toContain("assertLightningPageAccess(match[2]"); expect(source).toContain("?!api/|");
    expect(source).not.toContain("request.text("); expect(source).not.toContain("request.arrayBuffer(");
  });
});
