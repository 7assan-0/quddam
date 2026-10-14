// Opt-in private staging launcher. This does not install or deploy anything.
// Inspect the exact Next-loaded environment before starting the application.
import { spawn } from "node:child_process";
import nextEnv from "@next/env";
import { inspectStagingConfiguration } from "./staging-preflight.mjs";

if (process.argv.length !== 2) {
  console.error("STAGING_START_UNEXPECTED_ARGUMENTS");
  process.exit(1);
}
if (process.env.NODE_ENV !== "production") {
  console.error("STAGING_NODE_ENV_NOT_PRODUCTION");
  process.exit(1);
}
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), false);
const report = inspectStagingConfiguration(process.env);
const errors = [...report.errors];
if (process.env.STAGING_ACCESS_MODE !== "private-network") errors.push("STAGING_REQUIRES_PRIVATE_NETWORK");
if (process.env.AUTH_TRUST_PROXY !== "false") errors.push("STAGING_REQUIRES_UNTRUSTED_PROXY_MODE");
if (errors.length) {
  // Only fixed setting names/error codes, never values from env or connection strings.
  console.error(JSON.stringify({ status: "STAGING_START_REFUSED", errors: [...new Set(errors)] }));
  process.exit(1);
}
console.log("STAGING_CONFIG_PRECHECK_PASS_NOT_NETWORK_PROOF");
const child = spawn(process.execPath,
  ["--import", "tsx", "scripts/start-production.ts", "--hostname", "127.0.0.1", "--port", "3000"],
  { cwd: process.cwd(), env: process.env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { console.error("STAGING_CHILD_START_FAILED"); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal === "SIGTERM" ? 143 : 1); });
