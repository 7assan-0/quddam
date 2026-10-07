import { db } from "../src/lib/db";
import { pruneAuthAttempts } from "../src/lib/auth/abuse";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be configured");
  let removed = 0;
  try {
    // Bounded daily work; repeat the job if more than 10,000 stale keys accumulated.
    for (let batch = 0; batch < 20; batch++) {
      const count = await pruneAuthAttempts(); removed += count;
      if (count < 500) break;
    }
    console.log(JSON.stringify({ removedAuthAttemptCounters: removed }));
  } finally { await db().$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Auth counter cleanup failed"); process.exitCode = 1; });
