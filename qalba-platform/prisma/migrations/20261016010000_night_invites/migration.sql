-- Planning invite is separate from gameplay Room and its fixed one-hour expiry.
-- Additive only: no changes to games, credit ledger, payment or historical Night receipts.
CREATE TABLE "NightInvitation" (
 "id" TEXT NOT NULL, "nightId" TEXT NOT NULL, "tokenHash" CHAR(64) NOT NULL,
 "scheduledAt" TIMESTAMP(3) NOT NULL, "timezone" VARCHAR(64) NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "status" VARCHAR(16) NOT NULL DEFAULT 'open',
 "rateWindowAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "rateCount" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "NightInvitation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "NightInvitation_nightId_fkey" FOREIGN KEY ("nightId") REFERENCES "NightSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "NightInvitation_status_check" CHECK ("status" IN ('open','closed')),
 CONSTRAINT "NightInvitation_rate_check" CHECK ("rateCount" BETWEEN 0 AND 60),
 CONSTRAINT "NightInvitation_schedule_check" CHECK ("expiresAt" > "createdAt")
);
CREATE UNIQUE INDEX "NightInvitation_nightId_key" ON "NightInvitation"("nightId");
CREATE UNIQUE INDEX "NightInvitation_tokenHash_key" ON "NightInvitation"("tokenHash");
CREATE INDEX "NightInvitation_expiresAt_idx" ON "NightInvitation"("expiresAt");

CREATE TABLE "NightInviteGuest" (
 "id" TEXT NOT NULL, "inviteId" TEXT NOT NULL,
 "capabilityHash" CHAR(64) NOT NULL, "name" VARCHAR(60) NOT NULL,
 "nameKey" VARCHAR(60) NOT NULL, "rsvp" VARCHAR(8) NOT NULL, "gameVote" VARCHAR(60),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "NightInviteGuest_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "NightInviteGuest_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "NightInvitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "NightInviteGuest_rsvp_check" CHECK ("rsvp" IN ('YES','NO'))
);
CREATE UNIQUE INDEX "NightInviteGuest_capabilityHash_key" ON "NightInviteGuest"("capabilityHash");
CREATE UNIQUE INDEX "NightInviteGuest_inviteId_nameKey_key" ON "NightInviteGuest"("inviteId","nameKey");
CREATE INDEX "NightInviteGuest_inviteId_rsvp_idx" ON "NightInviteGuest"("inviteId","rsvp");
