-- CreateTable
CREATE TABLE "LightningQuestion" (
    "id" TEXT NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "normalizedQuestion" VARCHAR(500) NOT NULL,
    "answer" VARCHAR(160) NOT NULL,
    "alternativeAnswers" TEXT[],
    "categoryId" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'ar-SA',
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "explanation" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LightningQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LightningQuestionUse" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "gameRoundId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LightningQuestionUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LightningBuzzerAccess" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "permission" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "LightningBuzzerAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LightningQuestion_normalizedQuestion_key" ON "LightningQuestion"("normalizedQuestion");

-- CreateIndex
CREATE INDEX "LightningQuestion_status_locale_categoryId_difficulty_idx" ON "LightningQuestion"("status", "locale", "categoryId", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "LightningQuestionUse_gameRoundId_key" ON "LightningQuestionUse"("gameRoundId");

-- CreateIndex
CREATE INDEX "LightningQuestionUse_sessionId_selectedAt_idx" ON "LightningQuestionUse"("sessionId", "selectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LightningQuestionUse_sessionId_matchNumber_questionIndex_key" ON "LightningQuestionUse"("sessionId", "matchNumber", "questionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "LightningQuestionUse_sessionId_matchNumber_questionId_key" ON "LightningQuestionUse"("sessionId", "matchNumber", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "LightningBuzzerAccess_tokenHash_key" ON "LightningBuzzerAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "LightningBuzzerAccess_sessionId_teamId_expiresAt_idx" ON "LightningBuzzerAccess"("sessionId", "teamId", "expiresAt");

-- AddForeignKey
ALTER TABLE "LightningQuestion" ADD CONSTRAINT "LightningQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightningQuestionUse" ADD CONSTRAINT "LightningQuestionUse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightningQuestionUse" ADD CONSTRAINT "LightningQuestionUse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LightningQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightningQuestionUse" ADD CONSTRAINT "LightningQuestionUse_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightningBuzzerAccess" ADD CONSTRAINT "LightningBuzzerAccess_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightningBuzzerAccess" ADD CONSTRAINT "LightningBuzzerAccess_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Buzzer credentials can never imply Host or display permissions.
ALTER TABLE "LightningBuzzerAccess" ADD CONSTRAINT "LightningBuzzerAccess_permission_check" CHECK ("permission" IN ('TEAM_A_BUZZ','TEAM_B_BUZZ'));
ALTER TABLE "LightningBuzzerAccess" ADD CONSTRAINT "LightningBuzzerAccess_match_check" CHECK ("matchNumber" > 0);
CREATE UNIQUE INDEX "LightningBuzzerAccess_one_active_team" ON "LightningBuzzerAccess"("sessionId", "teamId") WHERE "revokedAt" IS NULL;
