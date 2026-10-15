/** Synthetic acceptance driver through existing canonical services only.
 * It never writes GameSession.state, scores, completion, or credit entries.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import * as ranked from "../src/lib/games/ranked/service";
import * as ordering from "../src/lib/games/ordering/service";
import * as survey from "../src/lib/games/survey-battle/service";
import type { Action as RankedAction, List } from "../src/lib/games/ranked/module";
import type { HostAction, Question } from "../src/lib/games/ordering/module";
import type { Action as SurveyAction } from "../src/lib/games/survey-battle/module";
import type { NightGameSlug } from "../src/lib/night/catalog";

export async function completeCanonicalGame(id: string, ownerId: string, game: NightGameSlug, outcome: "A" | "B" | "TIE" = "A") {
  const actor = { kind: "HOST" as const, id: ownerId };
  if (game === "top-list") {
    const command = async (action: RankedAction) => ranked.applyRankedCommand(id, ownerId, randomUUID(), (await ranked.getRankedView(id, actor)).version, action);
    await command({ type: "START" });
    for (let index = 0; index < 5; index++) {
      await command({ type: "START_ROUND" });
      const use = await db().rankedListUse.findUniqueOrThrow({ where: { sessionId_matchNumber_roundIndex: { sessionId: id, matchNumber: 1, roundIndex: index } } });
      const list = use.snapshot as unknown as List;
      if (outcome !== "TIE") {
        // Take a normal incorrect turn when necessary, then make one correct guess.
        const current = await ranked.getRankedView(id, actor);
        const desiredIndex = outcome === "A" ? 0 : 1;
        if (current.activeTeamId !== current.teams[desiredIndex].id) await command({ type: "SUBMIT_GUESS", guess: "إجابة اختبار غير مدرجة" });
        await command({ type: "SUBMIT_GUESS", guess: list.entries[0].answer });
      }
      await command({ type: "END_ROUND" });
      await command({ type: "NEXT_ROUND" });
    }
    await command({ type: "COMPLETE" });
  } else if (game === "ordering-challenge") {
    const command = async (action: HostAction) => ordering.applyOrderingCommand(id, ownerId, randomUUID(), (await ordering.getOrderingView(id, actor)).version, action);
    await command({ type: "START" });
    const initial = await ordering.getOrderingView(id, actor);
    const access = await Promise.all(initial.teams.map(team => ordering.createOrderingControllerAccess(ownerId, id, team.id)));
    await command({ type: "START_ROUND" });
    for (let index = 0; index < 7; index++) {
      const use = await db().orderingQuestionUse.findUniqueOrThrow({ where: { sessionId_matchNumber_roundIndex: { sessionId: id, matchNumber: 1, roundIndex: index } } });
      const question = use.snapshot as unknown as Question;
      const perfect = [...question.items].sort((a, b) => a.correctPosition - b.correctPosition).map(item => item.id);
      for (const [team, link] of access.entries()) {
        const view = await ordering.getOrderingView(id, { kind: "CONTROLLER", token: link.token });
        await ordering.applyOrder(id, link.token, randomUUID(), view.revision!, { type: "SUBMIT_ORDER", roundNumber: index + 1, order: outcome === "TIE" || (outcome === "A" ? team === 0 : team === 1) ? perfect : [...perfect].reverse() });
      }
      await command({ type: "SHOW_RESULT" });
      await command({ type: "NEXT_ROUND" });
    }
    await command({ type: "COMPLETE" });
  } else {
    assert.notEqual(outcome, "TIE", "Use dedicated partial/final tie scenarios rather than fabricate a tied survey score");
    const command = async (action: SurveyAction) => survey.applySurveyCommand(id, ownerId, randomUUID(), (await survey.getSurveyView(id, actor)).version, action);
    await command({ type: "START" });
    for (let index = 0; index < 5; index++) {
      await command({ type: "START_ROUND" });
      const view = await survey.getSurveyView(id, actor) as survey.HostView;
      const winner = outcome === "A" ? 0 : 1;
      await command({ type: "FACE_OFF_GUESS", teamIndex: winner, answerId: view.answers[0].id });
      await command({ type: "FACE_OFF_GUESS", teamIndex: winner === 0 ? 1 : 0, answerId: null });
      await command({ type: "BEGIN_ANSWERING" });
      for (const answer of view.answers.slice(1)) await command({ type: "GUESS_CORRECT", answerId: answer.id });
      await command({ type: "AWARD_ROUND" });
      await command({ type: "NEXT_ROUND" });
    }
    await command({ type: "COMPLETE" });
  }
  const session = await db().gameSession.findUniqueOrThrow({ where: { id } });
  assert.equal(session.status, "COMPLETED");
  assert.equal((session.state as { phase: string }).phase, "COMPLETED");
  assert.equal(await db().gameCredit.count({ where: { userId: ownerId, idempotencyKey: `game-start:${id}`, delta: -1 } }), 1);
  return { game, status: session.status, rounds: game === "ordering-challenge" ? 7 : 5 };
}
