-- Metadata/indexes only: no cleanup or snapshot backfill on deployment.
ALTER TABLE "SocialRound" ADD COLUMN "retainedVoteCounts" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "SocialRound" ADD CONSTRAINT "SocialRound_retainedVoteCounts_object_check"
  CHECK (jsonb_typeof("retainedVoteCounts") = 'object');
ALTER TABLE "CourtRound" ADD COLUMN "retainedVoteCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CourtRound" ADD CONSTRAINT "CourtRound_retainedVoteCount_nonnegative"
  CHECK ("retainedVoteCount" >= 0);
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
CREATE INDEX "AuthSession_retention_revoked_idx" ON "AuthSession"("revokedAt") WHERE "revokedAt" IS NOT NULL;
CREATE INDEX "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");
CREATE INDEX "PasswordReset_retention_used_idx" ON "PasswordReset"("usedAt") WHERE "usedAt" IS NOT NULL;
CREATE INDEX "GameSession_status_endedAt_id_idx" ON "GameSession"("status","endedAt","id");
CREATE INDEX "Room_expiresAt_idx" ON "Room"("expiresAt");
CREATE INDEX "DisplayAccess_expiresAt_idx" ON "DisplayAccess"("expiresAt");
CREATE INDEX "DisplayAccess_retention_revoked_idx" ON "DisplayAccess"("revokedAt") WHERE "revokedAt" IS NOT NULL;
CREATE INDEX "ForbiddenClueAccess_expiresAt_idx" ON "ForbiddenClueAccess"("expiresAt");
CREATE INDEX "ForbiddenClueAccess_retention_revoked_idx" ON "ForbiddenClueAccess"("revokedAt") WHERE "revokedAt" IS NOT NULL;
CREATE INDEX "LightningBuzzerAccess_expiresAt_idx" ON "LightningBuzzerAccess"("expiresAt");
CREATE INDEX "LightningBuzzerAccess_retention_revoked_idx" ON "LightningBuzzerAccess"("revokedAt") WHERE "revokedAt" IS NOT NULL;
CREATE INDEX "OrderingControllerAccess_expiresAt_idx" ON "OrderingControllerAccess"("expiresAt");
CREATE INDEX "OrderingControllerAccess_retention_revoked_idx" ON "OrderingControllerAccess"("revokedAt") WHERE "revokedAt" IS NOT NULL;
