import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { applyPartyCommand, createPartySession, getPartySession } from "../src/lib/games/party/service";
import type { PartyAction, PartySlug } from "../src/lib/games/party/types";

async function main() {
  const user = await db().user.create({ data: { email: `party-${randomUUID()}@example.test`, name: "مضيف" } });
  await db().creditWallet.create({ data: { userId: user.id, balance: 10 } });
  const slugs: PartySlug[] = ["letter-battle", "bluff", "fastest-mind", "top-list", "secret-word", "survey-show", "party-court"];
  for (const slug of slugs) {
    let view = await createPartySession(user.id, slug, { teamNames: ["البرق", "الموج"], playerNames: slug === "bluff" || slug === "party-court" ? ["أحمد", "نورة", "خالد"] : [], timerSeconds: 30 });
    assert.equal(view.status, "LOBBY");
    const send = async (action: PartyAction, key = randomUUID()) => { const response = await applyPartyCommand(user.id, view.id, key, view.version, action); view = response.session; return response; };
    const startKey = randomUUID(); await send({ type: "START" }, startKey);
    const retry = await applyPartyCommand(user.id, view.id, startKey, 0, { type: "START" }); assert.equal(retry.duplicate, true);
    assert.equal(view.status, "IN_PROGRESS");
    const display = await getPartySession(user.id, view.id, true);
    if (slug === "secret-word") assert.equal(display.state.cards[0].answer, "");
    if (slug === "letter-battle") {
      for (const index of [0, 4, 8, 12]) { await send({ type: "OPEN", index }); await send({ type: "CAPTURE", teamId: view.teams[0].id }); }
      assert.equal(view.state.winnerId, view.teams[0].id);
    } else for (let round = 0; round < view.state.cards.length; round++) {
      const card = view.state.cards[view.state.index];
      if (slug === "bluff") { for (const [i, player] of view.players.entries()) await send({ type: "FAKE", playerId: player.id, value: `خدعة ${i}` }); await send({ type: "VOTING" });
        for (const player of view.players) await send({ type: "VOTE", playerId: player.id, value: "correct" }); await send({ type: "RESULT" }); }
      if (slug === "fastest-mind") await send({ type: "ANSWER", teamId: view.teams[0].id, value: card.answer });
      if (slug === "top-list") { const entry = (card.options as { text: string }[])[0]; await send({ type: "GUESS", teamId: view.teams[0].id, value: entry.text }); await send({ type: "REVEAL" }); }
      if (slug === "secret-word") { await send({ type: "CLUE", value: "شيء نعرفه جميعًا" }); await send({ type: "JUDGE", teamId: view.teams[0].id, value: "correct" }); }
      if (slug === "survey-show") { const entry = (card.options as { text: string }[])[0]; await send({ type: "GUESS", teamId: view.teams[0].id, value: entry.text }); if (view.state.phase !== "RESULT") await send({ type: "REVEAL" }); }
      if (slug === "party-court") { await send({ type: "VOTING" }); for (const player of view.players) await send({ type: "VOTE", playerId: player.id, value: "defense" }); await send({ type: "RESULT" }); }
      await send({ type: "NEXT" });
    }
    assert.equal(view.status, "COMPLETED", `${slug} completes`);
    assert.equal(await db().scoreEvent.count({ where: { sessionId: view.id } }) > 0, true);
    assert.equal(await db().gameCredit.count({ where: { idempotencyKey: `game-start:${view.id}` } }), 1);
    for (const name of ["GAME_CREATED", "GAME_STARTED", "GAME_COMPLETED", "QUESTION_OPENED", "QUESTION_ANSWERED"]) assert.equal(await db().analyticsEvent.count({ where: { userId: user.id, name, properties: { path: ["sessionId"], equals: view.id } } }) > 0, true, `${slug} ${name}`);
    assert.equal(await db().gameSession.findUniqueOrThrow({ where: { id: view.id }, select: { status: true } }).then(s => s.status), "COMPLETED");
    console.log(`${slug}: full session and one-time credit passed.`);
  }
  assert.equal((await db().creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance, 6);
  await db().$disconnect();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
