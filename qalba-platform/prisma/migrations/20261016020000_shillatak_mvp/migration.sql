-- Additive private Shillatak MVP. No wallet, payment, source game or historic migration changes.
CREATE TABLE "Shilla" (
 "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "name" VARCHAR(60) NOT NULL,
 "status" VARCHAR(16) NOT NULL DEFAULT 'active',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Shilla_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Shilla_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Shilla_status_check" CHECK ("status" IN ('active','archived'))
);
CREATE INDEX "Shilla_ownerId_createdAt_idx" ON "Shilla"("ownerId","createdAt");
CREATE TABLE "ShillaMembership" (
 "id" TEXT NOT NULL, "shillaId" TEXT NOT NULL, "userId" TEXT NOT NULL,
 "role" VARCHAR(16) NOT NULL, "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ShillaMembership_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ShillaMembership_shillaId_fkey" FOREIGN KEY ("shillaId") REFERENCES "Shilla"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ShillaMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ShillaMembership_role_check" CHECK ("role" IN ('OWNER','MEMBER'))
);
CREATE UNIQUE INDEX "ShillaMembership_shillaId_userId_key" ON "ShillaMembership"("shillaId","userId");
CREATE INDEX "ShillaMembership_userId_joinedAt_idx" ON "ShillaMembership"("userId","joinedAt");
CREATE UNIQUE INDEX "ShillaMembership_one_owner" ON "ShillaMembership"("shillaId") WHERE "role" = 'OWNER';
CREATE TABLE "ShillaTeam" (
 "id" TEXT NOT NULL, "shillaId" TEXT NOT NULL, "position" INTEGER NOT NULL,
 "name" VARCHAR(60) NOT NULL, "nameKey" VARCHAR(120) NOT NULL,
 CONSTRAINT "ShillaTeam_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ShillaTeam_shillaId_fkey" FOREIGN KEY ("shillaId") REFERENCES "Shilla"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ShillaTeam_position_check" CHECK ("position" IN (0,1))
);
CREATE UNIQUE INDEX "ShillaTeam_shillaId_position_key" ON "ShillaTeam"("shillaId","position");
CREATE UNIQUE INDEX "ShillaTeam_shillaId_nameKey_key" ON "ShillaTeam"("shillaId","nameKey");
CREATE TABLE "ShillaInvite" (
 "id" TEXT NOT NULL, "shillaId" TEXT NOT NULL, "tokenHash" CHAR(64) NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ShillaInvite_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ShillaInvite_shillaId_fkey" FOREIGN KEY ("shillaId") REFERENCES "Shilla"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShillaInvite_tokenHash_key" ON "ShillaInvite"("tokenHash");
CREATE INDEX "ShillaInvite_shillaId_expiresAt_idx" ON "ShillaInvite"("shillaId","expiresAt");
CREATE TABLE "ShillaNight" (
 "id" TEXT NOT NULL, "shillaId" TEXT NOT NULL, "nightId" TEXT NOT NULL,
 "snapshot" JSONB NOT NULL, "sourceDigest" CHAR(64) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ShillaNight_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ShillaNight_shillaId_fkey" FOREIGN KEY ("shillaId") REFERENCES "Shilla"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ShillaNight_nightId_fkey" FOREIGN KEY ("nightId") REFERENCES "NightSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShillaNight_nightId_key" ON "ShillaNight"("nightId");
CREATE INDEX "ShillaNight_shillaId_createdAt_idx" ON "ShillaNight"("shillaId","createdAt");
-- Accepted audit receipts may not be silently rewritten or deleted.
CREATE FUNCTION shilla_night_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Shillatak completed Night audit rows are immutable'; END $$;
CREATE TRIGGER "ShillaNight_immutable" BEFORE UPDATE OR DELETE ON "ShillaNight"
 FOR EACH ROW EXECUTE FUNCTION shilla_night_immutable();
