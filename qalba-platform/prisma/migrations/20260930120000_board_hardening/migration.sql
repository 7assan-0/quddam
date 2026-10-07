ALTER TABLE "Team" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GameCommand" ADD COLUMN "payloadHash" CHAR(64);

-- Preserve the order already recorded by the Category Board state for existing matches.
UPDATE "Team" AS t SET "position" = COALESCE((
  SELECT (entry.ordinality - 1)::integer
  FROM "GameSession" AS s,
       jsonb_array_elements_text(s.state -> 'teamIds') WITH ORDINALITY AS entry(team_id, ordinality)
  WHERE s.id = t."sessionId" AND entry.team_id = t.id
), 0);

CREATE TABLE "DisplayAccess" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "DisplayAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DisplayAccess_tokenHash_key" ON "DisplayAccess"("tokenHash");
CREATE INDEX "DisplayAccess_sessionId_expiresAt_idx" ON "DisplayAccess"("sessionId", "expiresAt");
ALTER TABLE "DisplayAccess" ADD CONSTRAINT "DisplayAccess_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
