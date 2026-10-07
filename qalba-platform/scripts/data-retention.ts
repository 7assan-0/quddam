import { db } from "../src/lib/db";
import { runRetention } from "../src/lib/retention/service";

// Internal operator/cron CLI. No endpoint or app-start/migration cleanup.
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--dry-run" && !arg.startsWith("--batch-size=") && !arg.startsWith("--cursor="))) throw new Error("Invalid retention option");
  const batch = args.find(arg => arg.startsWith("--batch-size="));
  const cursor = args.find(arg => arg.startsWith("--cursor="))?.slice(9);
  const result = await runRetention({ dryRun: args.includes("--dry-run"), batchSize: batch ? Number(batch.slice(13)) : undefined, cursor });
  console.log(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
}
main().catch(() => { console.error("Retention invocation failed; no private details logged"); process.exitCode = 1; }).finally(async () => { if (process.env.DATABASE_URL) await db().$disconnect(); });
