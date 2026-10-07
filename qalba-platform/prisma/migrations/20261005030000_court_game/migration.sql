-- CreateTable
CREATE TABLE "CourtCase" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "normalizedTitle" VARCHAR(180) NOT NULL,
    "scenario" VARCHAR(800) NOT NULL,
    "prosecutionPrompt" VARCHAR(400) NOT NULL,
    "defensePrompt" VARCHAR(400) NOT NULL,
    "rebuttalPrompt" VARCHAR(300),
    "categoryId" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'ar-SA',
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "contentRating" VARCHAR(30) NOT NULL DEFAULT 'FICTIONAL_PARTY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtCaseFact" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "text" VARCHAR(220) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CourtCaseFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourtParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtRound" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "gameRoundId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "scoreAudit" JSONB,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoredAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "CourtRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtRoundVote" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "choice" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourtRoundVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourtCase_normalizedTitle_key" ON "CourtCase"("normalizedTitle");

-- CreateIndex
CREATE INDEX "CourtCase_status_locale_categoryId_difficulty_idx" ON "CourtCase"("status", "locale", "categoryId", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "CourtCaseFact_caseId_position_key" ON "CourtCaseFact"("caseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CourtParticipant_tokenHash_key" ON "CourtParticipant"("tokenHash");

-- CreateIndex
CREATE INDEX "CourtParticipant_sessionId_active_position_idx" ON "CourtParticipant"("sessionId", "active", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CourtRound_gameRoundId_key" ON "CourtRound"("gameRoundId");

-- CreateIndex
CREATE INDEX "CourtRound_sessionId_selectedAt_idx" ON "CourtRound"("sessionId", "selectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourtRound_sessionId_matchNumber_number_key" ON "CourtRound"("sessionId", "matchNumber", "number");

-- CreateIndex
CREATE UNIQUE INDEX "CourtRound_sessionId_matchNumber_caseId_key" ON "CourtRound"("sessionId", "matchNumber", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtRoundVote_roundId_participantId_key" ON "CourtRoundVote"("roundId", "participantId");

-- AddForeignKey
ALTER TABLE "CourtCase" ADD CONSTRAINT "CourtCase_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtCaseFact" ADD CONSTRAINT "CourtCaseFact_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CourtCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtParticipant" ADD CONSTRAINT "CourtParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtRound" ADD CONSTRAINT "CourtRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtRound" ADD CONSTRAINT "CourtRound_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CourtCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtRound" ADD CONSTRAINT "CourtRound_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtRoundVote" ADD CONSTRAINT "CourtRoundVote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CourtRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtRoundVote" ADD CONSTRAINT "CourtRoundVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CourtParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guard private vote invariants and active lobby order independently of clients.
ALTER TABLE "CourtRoundVote" ADD CONSTRAINT "CourtRoundVote_choice_check" CHECK ("choice" IN ('PROSECUTION','DEFENSE'));
ALTER TABLE "CourtCaseFact" ADD CONSTRAINT "CourtCaseFact_position_check" CHECK ("position" >= 0 AND "position" <= 5);
ALTER TABLE "CourtRound" ADD CONSTRAINT "CourtRound_identity_check" CHECK ("matchNumber" > 0 AND "number" BETWEEN 1 AND 5);
CREATE UNIQUE INDEX "CourtParticipant_active_position_key" ON "CourtParticipant"("sessionId","position") WHERE "active" = true;
