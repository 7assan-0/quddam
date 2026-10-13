import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectStagingConfiguration } from "./staging-preflight.mjs";

const script = fileURLToPath(new URL("./staging-preflight.mjs", import.meta.url));
const fixture = () => ({
  STAGING_CONTEXT: "isolated-preparation", NODE_ENV: "production",
  APP_URL: "https://staging.example.test", STAGING_EXPECTED_ORIGIN: "https://staging.example.test",
  STAGING_ACCESS_MODE: "authenticated-ingress",
  DATABASE_URL: "postgresql://synthetic:synthetic@db.example.test/staging_review?sslmode=require",
  STAGING_EXPECTED_DATABASE: "staging_review", STAGING_ISOLATION_OWNER_APPROVED: "true",
  AUTH_RATE_LIMIT_SECRET: "synthetic-only-long-secret-not-for-deployment",
  PUBLIC_WELCOME_CREDITS_ENABLED: "false", AUTH_TRUST_PROXY: "false",
});
describe("isolated staging preflight; synthetic and network-free", () => {
  it("accepts only a private synthetic disabled-payment configuration shape", () => {
    const report = inspectStagingConfiguration(fixture());
    assert.equal(report.valid, true);
    assert.ok(report.warnings.includes("CONFIGURATION_SHAPE_ONLY_NO_DEPLOYMENT_OR_NETWORK_PROOF"));
  });
  it("rejects invalid canonical origin, public ingress and wrong database identity/TLS", () => {
    for (const bad of [
      { APP_URL: "http://staging.example.test" }, { STAGING_EXPECTED_ORIGIN: "https://another.example.test" },
      { STAGING_ACCESS_MODE: "public" },
      { DATABASE_URL: "postgresql://x:y@db.example.test/production?sslmode=require", STAGING_EXPECTED_DATABASE: "production" },
      { STAGING_EXPECTED_DATABASE: "wrong" },
      { DATABASE_URL: "postgresql://x:y@db.example.test/staging_review" },
      { STAGING_ISOLATION_OWNER_APPROVED: "false" },
    ]) assert.equal(inspectStagingConfiguration({ ...fixture(), ...bad }).valid, false);
  });
  it("refuses payment, outbound services, bootstrap and welcome-credit gates", () => {
    for (const key of ["MOYASAR_SECRET_KEY","MOYASAR_CALLBACK_TOKEN","MOYASAR_PUBLISHABLE_KEY",
      "BILLING_CRON_SECRET","SMTP_HOST","SMTP_USER","SMTP_PASSWORD","SMTP_FROM",
      "ANALYTICS_CRON_SECRET","BOOTSTRAP_ADMIN_EMAIL","BOOTSTRAP_ADMIN_PASSWORD",
      "SEED_ADMIN_EMAIL","SEED_ADMIN_PASSWORD","SEED_USER_EMAIL","SEED_USER_PASSWORD"]) {
      const report = inspectStagingConfiguration({ ...fixture(), [key]: "synthetic-private-value" });
      assert.equal(report.valid, false, key);
      assert.ok(report.errors.includes(key + "_MUST_BE_ABSENT"));
      assert.doesNotMatch(JSON.stringify(report), /synthetic-private-value/);
    }
    assert.equal(inspectStagingConfiguration({ ...fixture(), PUBLIC_WELCOME_CREDITS_ENABLED: "true" }).valid, false);
  });
  it("trusted proxy mode requires evidence IDs and dedicated header, but never proves deployment", () => {
    const base = { ...fixture(), AUTH_TRUST_PROXY: "true" };
    assert.equal(inspectStagingConfiguration(base).valid, false);
    const good = { ...base, AUTH_CLIENT_IP_HEADER: "x-quddam-client-ip",
      STAGING_PROXY_EVIDENCE_ID: "review-123", STAGING_DIRECT_INGRESS_EVIDENCE_ID: "review-124" };
    const report = inspectStagingConfiguration(good);
    assert.equal(report.valid, true);
    assert.ok(report.warnings.includes("PROXY_EVIDENCE_REQUIRES_INDEPENDENT_OPERATOR_REVIEW"));
    assert.equal(inspectStagingConfiguration({ ...good, AUTH_CLIENT_IP_HEADER: "x-forwarded-for" }).valid, false);
  });
  it("returns redacted nonzero CLI failure without leaking DB credentials", () => {
    const secret = "synthetic-do-not-echo-private-value-123456";
    const run = spawnSync(process.execPath, [script], {
      encoding: "utf8", env: { ...fixture(),
        DATABASE_URL: "postgresql://sensitive:" + secret + "@db.example.test/staging_review?sslmode=require",
        MOYASAR_SECRET_KEY: secret },
    });
    assert.equal(run.status, 1);
    const report = JSON.parse(run.stdout.trim());
    assert.equal(report.status, "CONFIGURATION_PRECHECK_FAIL");
    assert.ok(report.errors.includes("MOYASAR_SECRET_KEY_MUST_BE_ABSENT"));
    assert.doesNotMatch(run.stdout + run.stderr, new RegExp(secret));
    assert.doesNotMatch(run.stdout + run.stderr, /postgresql:\/\//);
  });
});
