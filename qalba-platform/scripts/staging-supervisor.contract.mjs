// No infrastructure/network operations: validates review-only templates and launcher fail-closed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const file = relative => readFileSync(new URL("../" + relative, import.meta.url), "utf8");

test("private staging service is opt-in, non-root, restricted and fails closed through launcher", () => {
  const unit = file("ops/staging/quddam-staging.service.template");
  for (const snippet of [
    "User=quddam-staging", "Group=quddam-staging",
    "EnvironmentFile=/etc/quddam-staging/app.env",
    "ExecStart=/usr/bin/node scripts/start-staging.mjs",
    "Restart=on-failure", "NoNewPrivileges=true",
    "ProtectSystem=strict", "ProtectHome=true",
  ]) assert.ok(unit.includes(snippet), snippet);
  assert.doesNotMatch(unit, /^ExecStart=.*next start/m);
  assert.doesNotMatch(unit, /^ExecStartPre=.*migrate|seed|deploy/m);
});
test("staging launcher loads Next environment before preflight and pins loopback listener", () => {
  const source = file("scripts/start-staging.mjs");
  assert.ok(source.indexOf("loadEnvConfig(process.cwd(), false)") < source.indexOf("inspectStagingConfiguration(process.env)"));
  assert.match(source, /STAGING_REQUIRES_PRIVATE_NETWORK/);
  assert.match(source, /STAGING_REQUIRES_UNTRUSTED_PROXY_MODE/);
  assert.match(source, /"--hostname", "127\.0\.0\.1", "--port", "3000"/);
  const secret = "synthetic-NOT-FOR-DEPLOYMENT-private-value";
  const result = spawnSync(process.execPath, ["scripts/start-staging.mjs"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
    timeout: 10000,
    env: {
      PATH: process.env.PATH, NODE_ENV: "production",
      STAGING_CONTEXT: "unapproved",
      STAGING_PROVIDER: "oci",
      STAGING_ACCESS_MODE: "private-network",
      AUTH_TRUST_PROXY: "false",
      AUTH_RATE_LIMIT_SECRET: secret,
      APP_URL: "https://staging.example.invalid",
    },
  });
  assert.equal(result.status, 1, result.error?.message);
  assert.match(result.stderr, /STAGING_START_REFUSED/);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-NOT-FOR-DEPLOYMENT-private-value/);
  assert.doesNotMatch(result.stdout + result.stderr, /postgresql:\/\//);
});
test("private ingress binds only selected interface, uses loopback upstream and removes identity headers", () => {
  const nginx = file("ops/staging/nginx-private-https.conf.template");
  assert.match(nginx, /^\s*listen __PRIVATE_VPN_IP__:443 ssl;/m);
  assert.doesNotMatch(nginx, /^\s*listen (?:443|0\.0\.0\.0:443|\[::\]:443)/m);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3000;/);
  for (const header of ["X-Quddam-Client-IP", "X-Forwarded-For", "X-Real-IP", "Forwarded"]) {
    assert.ok(nginx.includes('proxy_set_header ' + header + ' "";'), header);
  }
  assert.match(nginx, /proxy_buffering off;/);
  assert.match(nginx, /if \(\$host != __STAGING_FQDN__\) \{ return 421; \}/);
});
