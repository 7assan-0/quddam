import type { Page } from "@playwright/test";
import { Pool } from "pg";
import { TEAM_COLORS } from "../../../src/lib/design/team-colors";
import { letterGrid } from "../../../src/lib/games/party/content";
import type { Card, PartyState } from "../../../src/lib/games/party/types";

/** Existing-history fixture only. This never invokes or reopens a public legacy creation path. */
export async function openExistingLegacyLobby(page: Page, slug: "letter-battle" | "bluff", email: string) {
  if (!process.env.E2E_DATABASE_URL) throw new Error("Legacy fixture requires the isolated E2E database");
  const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 1 });
  const id = crypto.randomUUID();
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const user = (await client.query('SELECT id FROM "User" WHERE email=$1', [email])).rows[0];
      if (!user) throw new Error("Fixture owner is missing");
      const game = (await client.query('SELECT id FROM "GameType" WHERE slug=$1', [slug])).rows[0];
      const questions = (await client.query<Card>('SELECT id,question,answer,type,options,"alternativeAnswers","pointValue" FROM "Question" WHERE "gameTypeId"=$1 AND status=\'PUBLISHED\' ORDER BY id', [game.id])).rows;
      const cards = slug === "letter-battle" ? letterGrid.map(letter => {
        const card = questions.find(question => (question.options as { letter?: string } | null)?.letter === letter);
        if (!card) throw new Error("Missing historical letter card " + letter); return card;
      }) : questions.slice(0, 3);
      if (!cards.length) throw new Error("Historical card bank is missing");
      const teamIds = [crypto.randomUUID(), crypto.randomUUID()];
      const playerIds = slug === "bluff" ? [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()] : [];
      const state: PartyState = { schemaVersion: 1, slug, cards, index: 0, phase: "LOBBY", revealed: false,
        teamIds, playerIds, timerSeconds: 30, deadlineAt: null, remainingMs: 30_000, turn: 0,
        owners: slug === "letter-battle" ? Array(16).fill(null) : [], selected: null, found: [], strikes: 0,
        fakes: {}, votes: {}, clues: [], winnerId: null, lastCapture: null };
      await client.query('INSERT INTO "GameSession" (id,"gameTypeId","hostId",config,state,"createdAt","updatedAt") VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$6)',
        [id, game.id, user.id, JSON.stringify({ timerSeconds: 30 }), JSON.stringify(state), "2025-01-01T12:00:00Z"]);
      for (let i = 0; i < 2; i++) await client.query('INSERT INTO "Team" (id,"sessionId",name,color,position) VALUES ($1,$2,$3,$4,$5)', [teamIds[i], id, i ? "فريق الموج" : "فريق البرق", TEAM_COLORS[i], i]);
      for (let i = 0; i < playerIds.length; i++) await client.query('INSERT INTO "Player" (id,"sessionId",name) VALUES ($1,$2,$3)', [playerIds[i], id, ["أحمد", "نورة", "خالد"][i]]);
      // Existing START/debit assertions run with a funded fixture even when public
      // welcome grants are disabled. No product credit policy or START code changes.
      const wallet = (await client.query('SELECT balance FROM "CreditWallet" WHERE "userId"=$1 FOR UPDATE', [user.id])).rows[0];
      if (!wallet) throw new Error("Fixture wallet is missing");
      if (wallet.balance < 1) {
        await client.query('INSERT INTO "GameCredit" (id,"userId",delta,reason,"idempotencyKey") VALUES ($1,$2,1,\'رصيد اختبار توافق قديم\',$3)', [crypto.randomUUID(), user.id, `legacy-fixture:${id}`]);
        await client.query('UPDATE "CreditWallet" SET balance=balance+1,"updatedAt"=now() WHERE "userId"=$1', [user.id]);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } finally { await pool.end(); }
  await page.goto(`/play/${id}`);
}
