/** Add a real-login credential to the existing isolated synthetic fixture owner.
 * No customer account, source-game result, or application startup import.
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/crypto";
import { isolatedEnvironment, loadFixture } from "./night-mvp-fixtures";

async function main() {
  const { output } = isolatedEnvironment();
  const fixture = await loadFixture();
  const user = await db().user.findUniqueOrThrow({ where: { id: fixture.ownerId } });
  const password = randomBytes(24).toString("hex");
  // Refuse to overwrite the sole private receipt before changing its synthetic account.
  writeFileSync(join(output, "phase4-auth.private.json"), JSON.stringify({ email: user.email, password }), { mode: 0o600, flag: "wx" });
  await db().user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  console.log("Isolated Phase 4 owner login credential prepared; private values withheld.");
}
main().catch(() => { console.error("Synthetic Phase 4 login fixture failed; private values withheld."); process.exitCode = 1; }).finally(() => db().$disconnect());
