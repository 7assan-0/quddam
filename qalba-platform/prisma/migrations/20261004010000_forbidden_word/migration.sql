CREATE TABLE "ForbiddenWordCard" (
 "id" TEXT PRIMARY KEY, "targetWord" VARCHAR(100) NOT NULL, "forbiddenWords" TEXT[] NOT NULL,
 "categoryId" TEXT NOT NULL, "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
 "locale" VARCHAR(10) NOT NULL DEFAULT 'ar-SA', "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ForbiddenWordCard_terms_check" CHECK (cardinality("forbiddenWords") BETWEEN 3 AND 6),
 CONSTRAINT "ForbiddenWordCard_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ForbiddenWordCard_status_locale_categoryId_difficulty_idx" ON "ForbiddenWordCard"("status","locale","categoryId","difficulty");
CREATE TABLE "ForbiddenWordCardUse" (
 "id" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL, "cardId" TEXT NOT NULL,
 "matchNumber" INTEGER NOT NULL, "position" INTEGER NOT NULL, "snapshot" JSONB NOT NULL,
 "roundIndex" INTEGER, "servedAt" TIMESTAMP(3), "resolvedAt" TIMESTAMP(3), "result" VARCHAR(20),
 CONSTRAINT "ForbiddenWordCardUse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ForbiddenWordCardUse_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "ForbiddenWordCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ForbiddenWordCardUse_result_check" CHECK ("result" IS NULL OR "result" IN ('CORRECT','SKIP','FOUL','TIMEOUT'))
);
CREATE UNIQUE INDEX "ForbiddenWordCardUse_sessionId_matchNumber_cardId_key" ON "ForbiddenWordCardUse"("sessionId","matchNumber","cardId");
CREATE UNIQUE INDEX "ForbiddenWordCardUse_sessionId_matchNumber_position_key" ON "ForbiddenWordCardUse"("sessionId","matchNumber","position");
CREATE INDEX "ForbiddenWordCardUse_cardId_servedAt_idx" ON "ForbiddenWordCardUse"("cardId","servedAt");
CREATE TABLE "ForbiddenClueAccess" (
 "id" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL, "tokenHash" CHAR(64) NOT NULL,
 "matchNumber" INTEGER NOT NULL, "roundIndex" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
 CONSTRAINT "ForbiddenClueAccess_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ForbiddenClueAccess_tokenHash_key" ON "ForbiddenClueAccess"("tokenHash");
CREATE INDEX "ForbiddenClueAccess_sessionId_expiresAt_idx" ON "ForbiddenClueAccess"("sessionId","expiresAt");
