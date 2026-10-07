CREATE TABLE "GameCommand" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "stateVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameCommand_sessionId_key_key" ON "GameCommand"("sessionId", "key");
CREATE INDEX "GameCommand_sessionId_createdAt_idx" ON "GameCommand"("sessionId", "createdAt");
ALTER TABLE "GameCommand" ADD CONSTRAINT "GameCommand_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing phase 1 installs had this game disabled; turn on the first playable module once.
UPDATE "GameType" SET "enabled" = true WHERE "slug" = 'category-board';
