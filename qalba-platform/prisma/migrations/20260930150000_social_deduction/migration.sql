CREATE TABLE "SecretWord" (
  "id" TEXT NOT NULL, "word" VARCHAR(100) NOT NULL, "categoryId" TEXT NOT NULL,
  "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY', "language" VARCHAR(10) NOT NULL DEFAULT 'ar',
  "status" "QuestionStatus" NOT NULL DEFAULT 'PUBLISHED', "alternativeAnswers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecretWord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SocialParticipant" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "tokenHash" CHAR(64) NOT NULL,
  "name" VARCHAR(60) NOT NULL, "position" INTEGER NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialParticipant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SocialRound" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "number" INTEGER NOT NULL,
  "secretWordId" TEXT NOT NULL, "outsiderId" TEXT NOT NULL,
  "winner" VARCHAR(20), "suspectedId" TEXT, "guess" VARCHAR(100),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" TIMESTAMP(3),
  CONSTRAINT "SocialRound_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SocialVote" (
  "id" TEXT NOT NULL, "roundId" TEXT NOT NULL, "ballot" INTEGER NOT NULL,
  "voterId" TEXT NOT NULL, "targetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialVote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecretWord_status_language_categoryId_idx" ON "SecretWord"("status", "language", "categoryId");
CREATE UNIQUE INDEX "SocialParticipant_tokenHash_key" ON "SocialParticipant"("tokenHash");
CREATE UNIQUE INDEX "SocialParticipant_sessionId_name_key" ON "SocialParticipant"("sessionId", "name");
CREATE UNIQUE INDEX "SocialParticipant_sessionId_position_key" ON "SocialParticipant"("sessionId", "position");
CREATE UNIQUE INDEX "SocialRound_sessionId_number_key" ON "SocialRound"("sessionId", "number");
CREATE INDEX "SocialRound_sessionId_startedAt_idx" ON "SocialRound"("sessionId", "startedAt");
CREATE UNIQUE INDEX "SocialVote_roundId_ballot_voterId_key" ON "SocialVote"("roundId", "ballot", "voterId");
CREATE INDEX "SocialVote_roundId_ballot_idx" ON "SocialVote"("roundId", "ballot");
ALTER TABLE "SecretWord" ADD CONSTRAINT "SecretWord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialParticipant" ADD CONSTRAINT "SocialParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialRound" ADD CONSTRAINT "SocialRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialRound" ADD CONSTRAINT "SocialRound_secretWordId_fkey" FOREIGN KEY ("secretWordId") REFERENCES "SecretWord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialRound" ADD CONSTRAINT "SocialRound_outsiderId_fkey" FOREIGN KEY ("outsiderId") REFERENCES "SocialParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialVote" ADD CONSTRAINT "SocialVote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "SocialRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialVote" ADD CONSTRAINT "SocialVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "SocialParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialVote" ADD CONSTRAINT "SocialVote_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "SocialParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
