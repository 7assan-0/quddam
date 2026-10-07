CREATE TABLE "SurveyQuestion" (
 "id" TEXT NOT NULL, "question" TEXT NOT NULL, "categoryId" TEXT NOT NULL,
 "difficulty" "Difficulty" NOT NULL, "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
 "locale" VARCHAR(10) NOT NULL DEFAULT 'ar-SA', "sourceType" VARCHAR(30) NOT NULL DEFAULT 'CURATED',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id"));
CREATE TABLE "SurveyAnswer" (
 "id" TEXT NOT NULL, "surveyQuestionId" TEXT NOT NULL, "answer" VARCHAR(200) NOT NULL,
 "alternativeAnswers" TEXT[] NOT NULL, "points" INTEGER NOT NULL CHECK ("points" > 0 AND "points" <= 1000),
 "position" INTEGER NOT NULL CHECK ("position" >= 0), CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id"));
CREATE TABLE "SurveyQuestionUse" (
 "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "questionId" TEXT NOT NULL,
 "matchNumber" INTEGER NOT NULL, "roundNumber" INTEGER NOT NULL, "snapshot" JSONB NOT NULL,
 "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SurveyQuestionUse_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "SurveyAnswer_surveyQuestionId_position_key" ON "SurveyAnswer"("surveyQuestionId", "position");
CREATE INDEX "SurveyQuestion_status_categoryId_difficulty_idx" ON "SurveyQuestion"("status", "categoryId", "difficulty");
CREATE UNIQUE INDEX "SurveyQuestionUse_sessionId_matchNumber_roundNumber_key" ON "SurveyQuestionUse"("sessionId", "matchNumber", "roundNumber");
CREATE UNIQUE INDEX "SurveyQuestionUse_sessionId_matchNumber_questionId_key" ON "SurveyQuestionUse"("sessionId", "matchNumber", "questionId");
CREATE INDEX "SurveyQuestionUse_questionId_openedAt_idx" ON "SurveyQuestionUse"("questionId", "openedAt");
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_surveyQuestionId_fkey" FOREIGN KEY ("surveyQuestionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyQuestionUse" ADD CONSTRAINT "SurveyQuestionUse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyQuestionUse" ADD CONSTRAINT "SurveyQuestionUse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
