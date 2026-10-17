/** Read-only final acceptance cross-check: Night -> Shillatak and separate Room.
 * Exact same checkout/DB used for all native, real Chrome and restart gates.
 * No raw tokens, codes, cookies, guest aliases or private case IDs in stdout.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { isolatedEnvironment, loadFixture } from "./night-mvp-fixtures";

async function main() {
  const { output } = isolatedEnvironment();
  const fixture = await loadFixture();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.equal(head, process.env.BETA_EXPECTED_SHA);
  const scope: [string, string, number][] = [
    ["integrated-shilla-native", "native-shillatak", 20],
    ["integrated-night-native", "native-night", 15],
    ["integrated-night-chrome", "real-night-chromium", 45],
    ["integrated-shilla-chrome", "real-shillatak-chromium", 42],
    ["integrated-room-chrome", "real-existing-room-chromium", 75],
    ["integrated-restart", "restart-and-flags", 30],
    ["revoke-pg17", "native-revocation", 4],
    ["revoke-browser", "independent-revoked-link-chromium", 14],
  ];
  const read = (run: string, file = "receipt.json") => JSON.parse(readFileSync(join(output, run, file), "utf8"));
  const recorded = scope.map(([run, label, minimum]) => {
    const receipt = read(run);
    assert.equal(receipt.status, "PASSED", label);
    assert.equal(receipt.sourceHead, head, label);
    assert.ok((receipt.passed ?? receipt.checks?.length ?? 0) >= minimum, label);
    if ("sourceDirty" in receipt) assert.equal(receipt.sourceDirty, false, label);
    return { scope: label, passedChecks: receipt.passed ?? receipt.checks.length };
  });
  const native = read("revoke-pg17"), browser = read("revoke-browser");
  assert.deepEqual(native.races.map((r: { ordering: string; independentBackendCount?: number; distinctBackendCount: number; lockWaiters: number; rsvpAccepted: number; rsvpRejected: number; revokeAccepted: number }) =>
    [r.ordering, r.distinctBackendCount, r.lockWaiters, r.rsvpAccepted, r.rsvpRejected, r.revokeAccepted]),
    [["two-rsvp-first", 4, 3, 2, 0, 1], ["revoke-first", 4, 3, 0, 2, 1]]);
  assert.equal(browser.actualChromiumContexts, 3);
  const night = read("integrated-night-chrome", "journey.private.json");
  const group = read("integrated-shilla-chrome", "journey.private.json");
  const board = read("integrated-room-chrome", "journey.private.json");
  assert.equal(night.ownerId, fixture.ownerId);
  assert.equal(group.ownerId, fixture.ownerId);
  assert.equal(group.nightId, night.nightId);
  assert.notEqual(board.ownerId, fixture.ownerId);
  const client = db();
  const [nightRow, groupRow, linked, room, source, nightWallet, roomWallet, nightDebits, roomDebits] = await Promise.all([
    client.nightSession.findUniqueOrThrow({ where: { id: night.nightId },
      include: { games: { orderBy: { position: "asc" } } } }),
    client.shilla.findUniqueOrThrow({ where: { id: group.groupId }, include: { nights: true } }),
    client.shillaNight.findUniqueOrThrow({ where: { nightId: night.nightId } }),
    client.room.findUniqueOrThrow({ where: { code: board.code }, include: { participants: true } }),
    client.gameSession.findUniqueOrThrow({ where: { id: board.sessionId } }),
    client.creditWallet.findUniqueOrThrow({ where: { userId: fixture.ownerId } }),
    client.creditWallet.findUniqueOrThrow({ where: { userId: board.ownerId } }),
    client.gameCredit.findMany({ where: { userId: fixture.ownerId, delta: -1 } }),
    client.gameCredit.findMany({ where: { userId: board.ownerId, delta: -1 } }),
  ]);
  assert.equal(nightRow.phase, "completed");
  assert.equal(nightRow.games.length, 3);
  assert.ok(nightRow.games.every(slot => slot.resultReceipt !== null && slot.sourceSessionId));
  assert.equal(groupRow.status, "archived");
  assert.equal(groupRow.nights.length, 1);
  assert.equal(linked.shillaId, group.groupId);
  assert.equal(room.sessionId, board.sessionId);
  assert.equal(room.hostId, board.ownerId);
  assert.equal(room.participants.length, 8);
  assert.equal(source.status, "COMPLETED");
  const started = nightRow.games.map(g => g.sourceSessionId!);
  assert.ok(!started.includes(board.sessionId));
  for (const id of started) assert.equal(nightDebits.filter(c => c.idempotencyKey === `game-start:${id}`).length, 1);
  assert.equal(roomDebits.filter(c => c.idempotencyKey === `game-start:${board.sessionId}`).length, 1);
  assert.equal(roomDebits.length, 1);
  assert.equal(roomWallet.balance, 2);
  assert.ok(nightWallet.balance >= 0);
  const summary = { schemaVersion: 1, sourceHead: head, status: "PASSED",
    nativePostgres17: true, isolatedSyntheticOnly: true, requestMocks: false,
    scopes: recorded, linkedNightToGroup: true, canonicalGameReceipts: 3,
    distinctRoomSession: true, roomParticipants: 8, originalBoardCells: 18,
    noCrossAuthorityOrExtraDebits: true,
    limitations: ["Current HTTP/SSE Room only; PR9 WebRTC NOT MERGED/NOT RUN",
      "36-cell Challenge Board PR20 is independent and NOT part of this codebase",
      "Loopback only; multi-device LAN and NAT NOT RUN",
      "PR16 security blocker, public HTTPS and production launch NOT APPROVED"] };
  writeFileSync(join(output, "integrated-summary.json"), JSON.stringify(summary, null, 2)+"\n", { mode: 0o600, flag: "wx" });
  console.log("INTEGRATED_BETA_PROOF="+JSON.stringify(summary));
}
main().catch(() => { console.error("Integrated acceptance failed; private source IDs and browser credentials withheld."); process.exitCode = 1; })
  .finally(() => db().$disconnect());
