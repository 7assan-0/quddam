/** I-1 synthetic PostgreSQL setup and aggregate verification; never application startup. */
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { hashPassword, newToken, tokenHash } from "../src/lib/auth/crypto";
import { createFixture, games, hostId, adminId, type Fixture } from "./database-lifecycle-fixtures";
import { grantAdminCredits } from "../src/lib/billing/credits";
const out = process.env.I1_OUTPUT!;
async function main() {
  assert.equal(process.env.CSP_TEST_DATABASE, "1"); assert.match(process.env.DATABASE_URL ?? "", /\/i1_launch$/);
  const client = db();
  if (process.argv.includes("--verify")) {
    const f = JSON.parse(readFileSync(out + "/fixture-private.json", "utf8")) as { fixtures: Fixture[] };
    for (const item of f.fixtures) {
      const s = await client.gameSession.findUniqueOrThrow({ where: { id: item.id } }); assert.ok(s.creditConsumedAt); assert.ok(s.stateVersion > 0);
      assert.equal(await client.gameCredit.count({ where: { idempotencyKey: `game-start:${item.id}`, delta: -1 } }), 1);
    }
    const purchases = await client.purchase.findMany({ where: { userId: hostId, status: "PAID" } }); assert.equal(purchases.length, 1);
    const p = purchases[0]; assert.equal(await client.gameCredit.count({ where: { idempotencyKey: `purchase:${p.id}`, delta: p.credits } }), 1);
    assert.ok((await client.creditWallet.findUniqueOrThrow({ where: { userId: hostId } })).balance >= 0);
    writeFileSync(out + "/Persisted-Invariants.json", JSON.stringify({ officialGames: 10, oneStartDebitEach: true, onePaidPurchase: true, onePurchaseGrant: true, walletNonnegative: true, schemaMigrations: await client.$queryRaw`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL`, privatePayloadsOmitted: true })); return;
  }
  for (const [id, role, email] of [[hostId, "USER", "f1-host@example.test"], [adminId, "ADMIN", "f1-admin@example.test"]] as const) await client.user.create({ data: { id, role, email, name: "اختبار توافق قدّام", passwordHash: await hashPassword("synthetic-security-123456") } });
  await grantAdminCredits(adminId, "f1-host@example.test", 500, "i1-synthetic-credit");
  const credential = async (userId: string) => { const token = newToken(); await client.authSession.create({ data: { userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 86400_000) } }); return token; };
  const hostToken = await credential(hostId), adminToken = await credential(adminId), revokedToken = await credential(hostId);
  await client.product.create({ data: { slug: "i1-synthetic-package", title: "باقة التوافق التجريبية", credits: 3, priceHalalas: 1500, currency: "SAR", active: true } });
  const fixtures: Fixture[] = []; for (const game of games) fixtures.push(await createFixture(game, false));
  const phone = fixtures.find(f => f.game === "board")!;
  const room = await client.room.create({ data: { code: "H7K2QP", hostId, sessionId: phone.id, expiresAt: new Date(Date.now() + 86400_000) } });
  const team = await client.team.findFirstOrThrow({ where: { sessionId: phone.id }, orderBy: { position: "asc" } });
  const player = await client.player.create({ data: { sessionId: phone.id, teamId: team.id, name: "هاتف التوافق" } }), phoneToken = newToken();
  await client.roomParticipant.create({ data: { roomId: room.id, playerId: player.id, teamId: team.id, name: player.name, tokenHash: tokenHash(phoneToken) } });
  writeFileSync(out + "/fixture-private.json", JSON.stringify({ fixtures, hostToken, adminToken, revokedToken, phone: { id: phone.id, code: room.code, phoneToken } }), { mode: 0o600 });
  const authored = await client.question.findMany({ where: { status: "PUBLISHED", category: { active: true } }, select: { imageUrl: true } });
  writeFileSync(out + "/Image-Origin-Inventory.json", JSON.stringify({ eligibleQuestionImages: authored.filter(q => q.imageUrl).length, externalOrigins: [...new Set(authored.filter(q => q.imageUrl && /^https?:/.test(q.imageUrl)).map(q => new URL(q.imageUrl!).origin))], runtimeSecretsExcluded: true }));
}
main().finally(() => db().$disconnect());
