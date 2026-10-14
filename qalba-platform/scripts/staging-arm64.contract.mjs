// Executed on the existing x64 preparation runner: no ARM runner / DB / OCI is started.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const root = new URL("../", import.meta.url);
const workflow = readFileSync(new URL("../../.github/workflows/staging-arm64-pg17.yml", import.meta.url), "utf8");
const probe = readFileSync(new URL("staging-arm64-pg17-ci.mjs", import.meta.url), "utf8");

test("native ARM64 / PG17 workflow is approval-label gated, not automatic", () => {
  assert.match(workflow, /pull_request:\s*\n\s*types: \[labeled\]/);
  assert.match(workflow, /github\.event\.pull_request\.number == 5/);
  assert.match(workflow, /github\.event\.label\.name == 'arm64-ci-approved'/);
  assert.doesNotMatch(workflow, /\n\s{2}(push|workflow_dispatch|schedule):/);
  assert.match(workflow, /runs-on: ubuntu-24\.04-arm/);
  assert.match(workflow, /image: postgres:17-alpine/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /npm ci --include=dev/);
  assert.match(workflow, /npm ci --omit=dev/);
  assert.match(workflow, /pg_dump .* -Fc/);
  assert.match(workflow, /pg_restore .* --exit-on-error/);
});
test("native probe rejects non-opted-in local testing before any connection", () => {
  const result = spawnSync(process.execPath, ["scripts/staging-arm64-pg17-ci.mjs", "before-backup"], {
    cwd: root, encoding: "utf8", timeout: 10000,
    env: { PATH: process.env.PATH, GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: "7assan-0/quddam",
      ARM64_STAGING_TEST_DATABASE: "0", DATABASE_URL: "postgresql://cannot-connect.invalid/no" },
  });
  assert.equal(result.status, 1, result.error?.message);
  assert.match(result.stderr, /Native ARM64 runner required|Explicit ephemeral CI opt-in required/);
  assert.doesNotMatch(result.stdout + result.stderr, /cannot-connect\.invalid/);
});
test("probe is restricted to local disposable CI database names and checks original migrations", () => {
  for (const invariant of [
    'assert.equal(url.hostname, "127.0.0.1")',
    'assert.equal(url.port, "55468")',
    'assert.equal(url.username, "quddam_arm_ci")',
    'assert.equal(url.pathname, "/quddam_arm64_ci")',
    'assert.equal(expected.length, 24',
    '"quddam_arm64_ci_restore"',
    'isolatedCloneRestore: "PASS"',
    'await original.query("ROLLBACK")',
  ]) assert.ok(probe.includes(invariant), invariant);
});
