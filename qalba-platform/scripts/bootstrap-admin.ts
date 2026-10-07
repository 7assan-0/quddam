import { loadEnvConfig } from "@next/env";
import { db } from "../src/lib/db";
import { AdminBootstrapError, bootstrapFirstAdmin } from "../src/lib/operations/bootstrap";
Object.assign(process.env, { NODE_ENV: "production" });
loadEnvConfig(process.cwd(), false);
bootstrapFirstAdmin(db(), { email: process.env.BOOTSTRAP_ADMIN_EMAIL, password: process.env.BOOTSTRAP_ADMIN_PASSWORD })
  .then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(error instanceof AdminBootstrapError ? error.message : "Admin bootstrap failed; inspect restricted database operational diagnostics"); process.exitCode = 1; })
  .finally(() => db().$disconnect());
