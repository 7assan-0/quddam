BEGIN;
-- No original round text/aliases existed in the legacy schema. Capture the
-- current bank once, explicitly marked LEGACY_BANK_CAPTURE; never claim that
-- this reconstructs text edited before migration. Future reads never use bank content.
ALTER TABLE "SocialRound" ADD COLUMN "wordSnapshot" VARCHAR(100),
  ADD COLUMN "alternativesSnapshot" TEXT[],
  ADD COLUMN "snapshotOrigin" VARCHAR(30) NOT NULL DEFAULT 'ROUND_CREATION';
UPDATE "SocialRound" AS r SET "wordSnapshot" = w."word",
  "alternativesSnapshot" = w."alternativeAnswers", "snapshotOrigin" = 'LEGACY_BANK_CAPTURE'
FROM "SecretWord" AS w WHERE w."id" = r."secretWordId";
ALTER TABLE "SocialRound" ALTER COLUMN "wordSnapshot" SET NOT NULL,
  ALTER COLUMN "alternativesSnapshot" SET NOT NULL;
ALTER TABLE "SocialRound" ADD CONSTRAINT "SocialRound_snapshotOrigin_check"
  CHECK ("snapshotOrigin" IN ('ROUND_CREATION', 'LEGACY_BANK_CAPTURE'));
-- Results remain writable; only the authored snapshot is immutable.
CREATE FUNCTION "protect_social_round_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."wordSnapshot" IS DISTINCT FROM OLD."wordSnapshot"
    OR NEW."alternativesSnapshot" IS DISTINCT FROM OLD."alternativesSnapshot"
    OR NEW."snapshotOrigin" IS DISTINCT FROM OLD."snapshotOrigin" THEN
    RAISE EXCEPTION 'SocialRound authored snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SocialRound_immutable_snapshot" BEFORE UPDATE ON "SocialRound"
FOR EACH ROW EXECUTE FUNCTION "protect_social_round_snapshot"();
COMMIT;
