-- CreateTable
CREATE TABLE "OrderingQuestion" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "normalizedTitle" VARCHAR(200) NOT NULL,
    "instruction" VARCHAR(500) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'ar-SA',
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "orderingType" VARCHAR(30) NOT NULL,
    "factual" BOOLEAN NOT NULL DEFAULT true,
    "sourceLabel" VARCHAR(200),
    "sourceUrl" VARCHAR(500),
    "sourceDate" DATE,
    "explanation" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderingItem" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "correctPosition" INTEGER NOT NULL,
    "acceptedAliases" TEXT[],
    "displayValue" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderingQuestionUse" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "gameRoundId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "scoreAudit" JSONB,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "OrderingQuestionUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderingControllerAccess" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "permission" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OrderingControllerAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderingQuestion_normalizedTitle_key" ON "OrderingQuestion"("normalizedTitle");

-- CreateIndex
CREATE INDEX "OrderingQuestion_status_locale_categoryId_difficulty_idx" ON "OrderingQuestion"("status", "locale", "categoryId", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "OrderingItem_questionId_correctPosition_key" ON "OrderingItem"("questionId", "correctPosition");

-- CreateIndex
CREATE UNIQUE INDEX "OrderingQuestionUse_gameRoundId_key" ON "OrderingQuestionUse"("gameRoundId");

-- CreateIndex
CREATE INDEX "OrderingQuestionUse_sessionId_selectedAt_idx" ON "OrderingQuestionUse"("sessionId", "selectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderingQuestionUse_sessionId_matchNumber_roundIndex_key" ON "OrderingQuestionUse"("sessionId", "matchNumber", "roundIndex");

-- CreateIndex
CREATE UNIQUE INDEX "OrderingQuestionUse_sessionId_matchNumber_questionId_key" ON "OrderingQuestionUse"("sessionId", "matchNumber", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderingControllerAccess_tokenHash_key" ON "OrderingControllerAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "OrderingControllerAccess_sessionId_teamId_expiresAt_idx" ON "OrderingControllerAccess"("sessionId", "teamId", "expiresAt");

-- AddForeignKey
ALTER TABLE "OrderingQuestion" ADD CONSTRAINT "OrderingQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderingItem" ADD CONSTRAINT "OrderingItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "OrderingQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderingQuestionUse" ADD CONSTRAINT "OrderingQuestionUse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderingQuestionUse" ADD CONSTRAINT "OrderingQuestionUse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "OrderingQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderingQuestionUse" ADD CONSTRAINT "OrderingQuestionUse_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderingControllerAccess" ADD CONSTRAINT "OrderingControllerAccess_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderingControllerAccess" ADD CONSTRAINT "OrderingControllerAccess_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderingItem" ADD CONSTRAINT "OrderingItem_position_check" CHECK ("correctPosition" BETWEEN 1 AND 8);
ALTER TABLE "OrderingControllerAccess" ADD CONSTRAINT "OrderingController_permission_check" CHECK ("permission" IN ('ORDER_TEAM_A','ORDER_TEAM_B'));
CREATE UNIQUE INDEX "OrderingController_active_team" ON "OrderingControllerAccess" ("sessionId","teamId") WHERE "revokedAt" IS NULL;
