-- Additive only: no historical session, wallet, payment or RC changes.
CREATE TABLE "NightSession" (
 "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "createKey" VARCHAR(80) NOT NULL,
 "createHash" CHAR(64) NOT NULL, "phase" VARCHAR(20) NOT NULL,
 "state" JSONB NOT NULL, "stateVersion" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "NightSession_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "NightSession_phase_check" CHECK ("phase" IN ('preparing','playing','completed','ended')),
 CONSTRAINT "NightSession_version_check" CHECK ("stateVersion" >= 0),
 CONSTRAINT "NightSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NightSession_ownerId_createKey_key" ON "NightSession"("ownerId","createKey");
CREATE INDEX "NightSession_ownerId_createdAt_idx" ON "NightSession"("ownerId","createdAt");
CREATE TABLE "NightGame" (
 "id" TEXT NOT NULL, "nightId" TEXT NOT NULL, "position" INTEGER NOT NULL,
 "gameSlug" VARCHAR(60) NOT NULL, "sourceSessionId" TEXT, "teamMapping" JSONB,
 "resultReceipt" JSONB, "resultDigest" CHAR(64), "sourceVersion" INTEGER,
 "acceptedAt" TIMESTAMP(3), CONSTRAINT "NightGame_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "NightGame_position_check" CHECK ("position" BETWEEN 0 AND 9),
 CONSTRAINT "NightGame_receipt_check" CHECK (("resultReceipt" IS NULL AND "resultDigest" IS NULL AND "sourceVersion" IS NULL AND "acceptedAt" IS NULL) OR ("resultReceipt" IS NOT NULL AND "resultDigest" IS NOT NULL AND "sourceVersion" >= 0 AND "acceptedAt" IS NOT NULL AND "sourceSessionId" IS NOT NULL AND "teamMapping" IS NOT NULL)),
 CONSTRAINT "NightGame_nightId_fkey" FOREIGN KEY ("nightId") REFERENCES "NightSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "NightGame_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NightGame_sourceSessionId_key" ON "NightGame"("sourceSessionId");
CREATE UNIQUE INDEX "NightGame_nightId_position_key" ON "NightGame"("nightId","position");
CREATE TABLE "NightCommand" (
 "id" TEXT NOT NULL, "nightId" TEXT NOT NULL, "key" VARCHAR(80) NOT NULL,
 "type" VARCHAR(20) NOT NULL, "payloadHash" CHAR(64) NOT NULL,
 "stateVersion" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "NightCommand_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "NightCommand_nightId_fkey" FOREIGN KEY ("nightId") REFERENCES "NightSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NightCommand_nightId_key_key" ON "NightCommand"("nightId","key");
-- Once linked/accepted, identities and receipts are append-only. No silent rematch rewrites.
CREATE FUNCTION night_game_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Night game audit rows are immutable'; END IF;
 IF NEW."nightId" IS DISTINCT FROM OLD."nightId" OR NEW."position" IS DISTINCT FROM OLD."position" OR NEW."gameSlug" IS DISTINCT FROM OLD."gameSlug" OR
    (OLD."sourceSessionId" IS NOT NULL AND (NEW."sourceSessionId" IS DISTINCT FROM OLD."sourceSessionId" OR NEW."teamMapping" IS DISTINCT FROM OLD."teamMapping")) OR
    (OLD."resultReceipt" IS NOT NULL AND (NEW."resultReceipt" IS DISTINCT FROM OLD."resultReceipt" OR NEW."resultDigest" IS DISTINCT FROM OLD."resultDigest" OR NEW."sourceVersion" IS DISTINCT FROM OLD."sourceVersion" OR NEW."acceptedAt" IS DISTINCT FROM OLD."acceptedAt"))
 THEN RAISE EXCEPTION 'Night game identity and accepted receipt are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "NightGame_immutable" BEFORE UPDATE OR DELETE ON "NightGame" FOR EACH ROW EXECUTE FUNCTION night_game_immutable();
CREATE FUNCTION night_command_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Night command audit rows are immutable'; END $$;
CREATE TRIGGER "NightCommand_immutable" BEFORE UPDATE OR DELETE ON "NightCommand" FOR EACH ROW EXECUTE FUNCTION night_command_immutable();
