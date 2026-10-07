-- CreateTable
CREATE TABLE "RankedListQuestion" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "normalizedTitle" VARCHAR(250) NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'ar-SA',
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "kind" VARCHAR(20) NOT NULL,
    "sourceLabel" VARCHAR(200),
    "sourceUrl" VARCHAR(2048),
    "sourceDate" VARCHAR(10),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankedListQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankedListEntry" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "answer" VARCHAR(160) NOT NULL,
    "alternativeAnswers" TEXT[],
    "points" INTEGER NOT NULL,
    "displayValue" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankedListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankedListUse" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "gameRoundId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankedListUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RankedListQuestion_normalizedTitle_key" ON "RankedListQuestion"("normalizedTitle");

-- CreateIndex
CREATE INDEX "RankedListQuestion_status_locale_categoryId_difficulty_idx" ON "RankedListQuestion"("status", "locale", "categoryId", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "RankedListEntry_questionId_rank_key" ON "RankedListEntry"("questionId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "RankedListUse_gameRoundId_key" ON "RankedListUse"("gameRoundId");

-- CreateIndex
CREATE INDEX "RankedListUse_sessionId_selectedAt_idx" ON "RankedListUse"("sessionId", "selectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RankedListUse_sessionId_matchNumber_roundIndex_key" ON "RankedListUse"("sessionId", "matchNumber", "roundIndex");

-- CreateIndex
CREATE UNIQUE INDEX "RankedListUse_sessionId_matchNumber_questionId_key" ON "RankedListUse"("sessionId", "matchNumber", "questionId");

-- AddForeignKey
ALTER TABLE "RankedListQuestion" ADD CONSTRAINT "RankedListQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankedListEntry" ADD CONSTRAINT "RankedListEntry_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RankedListQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankedListUse" ADD CONSTRAINT "RankedListUse_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankedListUse" ADD CONSTRAINT "RankedListUse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankedListUse" ADD CONSTRAINT "RankedListUse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RankedListQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "RankedListEntry" ADD CONSTRAINT "RankedListEntry_positive_rank_points" CHECK ("rank" > 0 AND "points" BETWEEN 1 AND 1000);
ALTER TABLE "RankedListQuestion" ADD CONSTRAINT "RankedListQuestion_kind" CHECK ("kind" IN ('CURATED', 'FACTUAL'));
