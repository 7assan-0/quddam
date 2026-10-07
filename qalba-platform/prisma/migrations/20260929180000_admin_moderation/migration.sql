ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "QuestionReport_userId_questionId_key" ON "QuestionReport"("userId", "questionId");
