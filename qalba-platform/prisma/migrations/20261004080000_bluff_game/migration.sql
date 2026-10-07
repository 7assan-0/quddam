-- CreateTable
CREATE TABLE "BluffQuestion" (
    "id" TEXT NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "normalizedQuestion" VARCHAR(500) NOT NULL,
    "correctAnswer" VARCHAR(160) NOT NULL,
    "alternativeCorrectAnswers" TEXT[],
    "categoryId" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'ar-SA',
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "explanation" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BluffQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BluffParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "position" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BluffParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BluffRound" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "choices" JSONB NOT NULL DEFAULT '[]',
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "submissionsClosedAt" TIMESTAMP(3),
    "scoredAt" TIMESTAMP(3),

    CONSTRAINT "BluffRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BluffAnswer" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "text" VARCHAR(160) NOT NULL,
    "normalizedText" VARCHAR(160) NOT NULL,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BluffAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BluffVote" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "choiceId" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BluffVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BluffScore" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "correctPoints" INTEGER NOT NULL,
    "bluffPoints" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BluffScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BluffModerationAudit" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BluffModerationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BluffQuestion_normalizedQuestion_key" ON "BluffQuestion"("normalizedQuestion");

-- CreateIndex
CREATE INDEX "BluffQuestion_status_categoryId_difficulty_idx" ON "BluffQuestion"("status", "categoryId", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "BluffParticipant_tokenHash_key" ON "BluffParticipant"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "BluffParticipant_sessionId_name_key" ON "BluffParticipant"("sessionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BluffParticipant_sessionId_position_key" ON "BluffParticipant"("sessionId", "position");

-- CreateIndex
CREATE INDEX "BluffRound_questionId_openedAt_idx" ON "BluffRound"("questionId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BluffRound_sessionId_matchNumber_number_key" ON "BluffRound"("sessionId", "matchNumber", "number");

-- CreateIndex
CREATE UNIQUE INDEX "BluffRound_sessionId_matchNumber_questionId_key" ON "BluffRound"("sessionId", "matchNumber", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "BluffAnswer_roundId_participantId_key" ON "BluffAnswer"("roundId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "BluffAnswer_roundId_normalizedText_key" ON "BluffAnswer"("roundId", "normalizedText");

-- CreateIndex
CREATE UNIQUE INDEX "BluffVote_roundId_participantId_key" ON "BluffVote"("roundId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "BluffScore_roundId_participantId_key" ON "BluffScore"("roundId", "participantId");

-- CreateIndex
CREATE INDEX "BluffModerationAudit_roundId_createdAt_idx" ON "BluffModerationAudit"("roundId", "createdAt");

-- AddForeignKey
ALTER TABLE "BluffQuestion" ADD CONSTRAINT "BluffQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluffParticipant" ADD CONSTRAINT "BluffParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluffRound" ADD CONSTRAINT "BluffRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluffRound" ADD CONSTRAINT "BluffRound_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "BluffQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluffAnswer" ADD CONSTRAINT "BluffAnswer_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "BluffRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluffAnswer" ADD CONSTRAINT "BluffAnswer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "BluffParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluffVote" ADD CONSTRAINT "BluffVote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "BluffRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluffVote" ADD CONSTRAINT "BluffVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "BluffParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluffScore" ADD CONSTRAINT "BluffScore_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "BluffRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluffScore" ADD CONSTRAINT "BluffScore_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "BluffParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluffModerationAudit" ADD CONSTRAINT "BluffModerationAudit_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "BluffRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluffModerationAudit" ADD CONSTRAINT "BluffModerationAudit_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "BluffAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

