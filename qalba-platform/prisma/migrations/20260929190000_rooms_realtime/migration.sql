ALTER TABLE "Room" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RoomParticipant" ADD COLUMN "playerId" TEXT, ADD COLUMN "tokenHash" CHAR(64), ADD COLUMN "teamId" TEXT;
CREATE UNIQUE INDEX "RoomParticipant_playerId_key" ON "RoomParticipant"("playerId");
CREATE UNIQUE INDEX "RoomParticipant_tokenHash_key" ON "RoomParticipant"("tokenHash");
ALTER TABLE "RoomParticipant" ADD CONSTRAINT "RoomParticipant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DROP INDEX "PlayerResponse_roundId_playerId_idx";
CREATE UNIQUE INDEX "PlayerResponse_roundId_playerId_key" ON "PlayerResponse"("roundId","playerId");
CREATE TABLE "RoomVote" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "option" VARCHAR(300) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoomVote_roundId_participantId_key" ON "RoomVote"("roundId","participantId");
ALTER TABLE "RoomVote" ADD CONSTRAINT "RoomVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "RoomParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomVote" ADD CONSTRAINT "RoomVote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "GameRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
