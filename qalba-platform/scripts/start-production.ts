import { spawn } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { productionEnvironment } from "../src/lib/operations/environment";
Object.assign(process.env, { NODE_ENV: "production" });
loadEnvConfig(process.cwd(), false);
const result = productionEnvironment(process.env);
if (!result.valid) { console.error(JSON.stringify({ errors: result.errors })); process.exitCode = 1; }
else {
  for (const warning of result.warnings) console.warn(warning);
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
  child.on("error", () => { console.error("Production server could not start"); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
