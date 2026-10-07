import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import type { SocialRound, LetterQuestionUse, SurveyQuestionUse } from "../../../src/generated/prisma/client";

export type ContentGame = "social" | "letter-network" | "survey-show";
export async function fixtureSql<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  if (!process.env.E2E_DATABASE_URL?.includes("127.0.0.1")) throw Error("Requires isolated native PostgreSQL");
  const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 2 });
  try { return (await pool.query<T>(text, values)).rows; } finally { await pool.end(); }
}
export async function socialRound(id: string) {
  return (await fixtureSql<SocialRound & { categoryId: string }>('SELECT r.*,w."categoryId" FROM "SocialRound" r JOIN "SecretWord" w ON w.id=r."secretWordId" WHERE r."sessionId"=$1 ORDER BY r.number DESC LIMIT 1', [id]))[0];
}
export function letterUses(id: string) {
  return fixtureSql<LetterQuestionUse & { categoryId: string }>('SELECT u.*,q."categoryId" FROM "LetterQuestionUse" u JOIN "LetterQuestion" q ON q.id=u."questionId" WHERE u."sessionId"=$1 ORDER BY u."openedAt",u.id', [id]);
}
export function surveyUses(id: string) {
  return fixtureSql<SurveyQuestionUse & { categoryId: string }>('SELECT u.*,q."categoryId" FROM "SurveyQuestionUse" u JOIN "SurveyQuestion" q ON q.id=u."questionId" WHERE u."sessionId"=$1 ORDER BY u."matchNumber",u."roundNumber"', [id]);
}

/** Disposable test bank. Existing authored rows are preserved; their category flags are restored. */
export async function contentBank(game: ContentGame) {
  const flags = await fixtureSql<{ id: string; active: boolean }>('SELECT id,active FROM "Category"');
  const table = game === "social" ? "SecretWord" : game === "letter-network" ? "LetterQuestion" : "SurveyQuestion";
  await fixtureSql(`UPDATE "Category" SET active=false WHERE id IN (SELECT "categoryId" FROM "${table}")`);
  const a = { id: randomUUID(), active: true }, b = { id: randomUUID(), active: false };
  for (const category of [a, b]) {
    await fixtureSql('INSERT INTO "Category" (id,slug,title,active,"updatedAt") VALUES ($1,$2,$3,$4,now())', [category.id, `d3-browser-${category.id}`, "فئة اختبار أهلية", category.active]);
    if (game === "social") await fixtureSql('INSERT INTO "SecretWord" (id,word,"categoryId","alternativeAnswers",status,"updatedAt") VALUES ($1,$2,$3,$4,\'PUBLISHED\',now())', [randomUUID(), `كلمة ثابتة ${category.id}`, category.id, [`بديل ثابت ${category.id}`]]);
    if (game === "letter-network") for (const letter of ["ا", "ب", "ج", "د", "ر"]) for (let i = 0; i < 8; i++) await fixtureSql('INSERT INTO "LetterQuestion" (id,letter,question,answer,"alternativeAnswers","categoryId",status,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,\'PUBLISHED\',now())', [randomUUID(), letter, `سؤال ${letter} ${i} ${category.id}`, `${letter}جابة ${i}`, [], category.id]);
    if (game === "survey-show") for (let i = 0; i < 5; i++) {
      const id = randomUUID(); await fixtureSql('INSERT INTO "SurveyQuestion" (id,question,"categoryId",difficulty,status,"updatedAt") VALUES ($1,$2,$3,\'EASY\',\'PUBLISHED\',now())', [id, `استطلاع ${i} ${category.id}`, category.id]);
      for (const [position, answer] of ["قهوة", "شاي", "ماء"].entries()) await fixtureSql('INSERT INTO "SurveyAnswer" (id,"surveyQuestionId",answer,"alternativeAnswers",points,position) VALUES ($1,$2,$3,$4,$5,$6)', [randomUUID(), id, answer, [], [50, 30, 20][position], position]);
    }
  }
  return { a, b, restore: async () => {
    for (const flag of flags) await fixtureSql('UPDATE "Category" SET active=$2 WHERE id=$1', [flag.id, flag.active]);
    await fixtureSql('UPDATE "Category" SET active=false WHERE id=ANY($1::text[])', [[a.id, b.id]]);
  } };
}

export async function gameplayFootprint(id: string) {
  const session = (await fixtureSql('SELECT * FROM "GameSession" WHERE id=$1', [id]))[0];
  const records: Record<string, unknown> = { session };
  for (const table of ["Room", "Team", "SocialParticipant", "GameCommand", "ScoreEvent", "SocialRound", "LetterQuestionUse", "SurveyQuestionUse"]) records[table] = await fixtureSql(`SELECT * FROM "${table}" WHERE "sessionId"=$1 ORDER BY id`, [id]);
  records.SocialVote = await fixtureSql('SELECT v.* FROM "SocialVote" v JOIN "SocialRound" r ON r.id=v."roundId" WHERE r."sessionId"=$1 ORDER BY v.id', [id]);
  records.CreditWallet = await fixtureSql('SELECT * FROM "CreditWallet" WHERE "userId"=$1', [session.hostId]);
  records.GameCredit = await fixtureSql('SELECT * FROM "GameCredit" WHERE "userId"=$1 ORDER BY id', [session.hostId]);
  records.AnalyticsEvent = await fixtureSql('SELECT * FROM "AnalyticsEvent" WHERE "userId"=$1 ORDER BY id', [session.hostId]);
  return records;
}
