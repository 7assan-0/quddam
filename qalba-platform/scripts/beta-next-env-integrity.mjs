/** Next 16 rewrites the tracked next-env.d.ts from dev to build route imports.
 * Verify ONLY its documented deterministic generated import-path change, then
 * restore the exact committed source bytes before source-binding and browser
 * acceptance. Never waive a mismatched hash or accept an arbitrary edit.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "qalba-platform/next-env.d.ts";
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(head, process.env.BETA_EXPECTED_SHA, "Literal expected candidate mismatch");
const original = execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf8" });
const generated = readFileSync("next-env.d.ts", "utf8");
const expectedProduction = original.replaceAll("./.next/dev/types/", "./.next/types/");
const changes = execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
assert.ok(changes.every(name => name === path), "Unexpected tracked source modification during the build");
assert.ok(generated === original || generated === expectedProduction,
  "Unexpected next-env.d.ts content; do not restore or bypass source integrity checks");
if (generated !== original) writeFileSync("next-env.d.ts", original, { encoding: "utf8" });
assert.equal(readFileSync("next-env.d.ts", "utf8"), original);
execFileSync("git", ["diff", "--quiet", "--", path]);
assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim(), "",
  "Any other authored or untracked source invalidates the acceptance run");
console.log("NEXT_GENERATED_TYPE_IMPORTS_VALIDATED_AND_COMMITTED_BYTES_RESTORED");
