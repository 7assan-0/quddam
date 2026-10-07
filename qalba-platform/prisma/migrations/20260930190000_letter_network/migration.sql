CREATE TABLE "LetterQuestion" (
  "id" TEXT NOT NULL, "letter" VARCHAR(2) NOT NULL, "question" TEXT NOT NULL, "answer" VARCHAR(200) NOT NULL,
  "alternativeAnswers" TEXT[] NOT NULL, "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY', "categoryId" TEXT NOT NULL,
  "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "LetterQuestion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LetterQuestionUse" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "questionId" TEXT NOT NULL, "matchNumber" INTEGER NOT NULL,
  "cellId" VARCHAR(12) NOT NULL, "questionSnapshot" TEXT NOT NULL, "answerSnapshot" VARCHAR(200) NOT NULL,
  "alternativesSnapshot" TEXT[] NOT NULL, "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LetterQuestionUse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LetterQuestion_letter_status_idx" ON "LetterQuestion"("letter","status");
CREATE INDEX "LetterQuestion_categoryId_difficulty_idx" ON "LetterQuestion"("categoryId","difficulty");
CREATE INDEX "LetterQuestionUse_sessionId_matchNumber_idx" ON "LetterQuestionUse"("sessionId","matchNumber");
CREATE INDEX "LetterQuestionUse_questionId_openedAt_idx" ON "LetterQuestionUse"("questionId","openedAt");
ALTER TABLE "LetterQuestion" ADD CONSTRAINT "LetterQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LetterQuestionUse" ADD CONSTRAINT "LetterQuestionUse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LetterQuestionUse" ADD CONSTRAINT "LetterQuestionUse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LetterQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
