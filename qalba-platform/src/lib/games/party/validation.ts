import { z } from "zod";
import { partySlugs } from "./types";
export const slugSchema = z.enum(partySlugs);
export const setupSchema = z.strictObject({ teamNames: z.tuple([z.string().trim().min(1).max(60), z.string().trim().min(1).max(60)]),
  playerNames: z.array(z.string().trim().min(1).max(60)).max(10), timerSeconds: z.number().int().min(10).max(180) });
export const commandSchema = z.strictObject({ key: z.string().uuid(), expectedVersion: z.number().int().min(0), action: z.strictObject({
  type: z.enum(["START", "END", "PAUSE", "RESUME", "TIMER", "TIMEOUT", "OPEN", "CAPTURE", "SKIP", "REPLACE", "UNDO", "REVEAL", "FAKE", "VOTING", "VOTE", "RESULT", "NEXT", "ANSWER", "GUESS", "CLUE", "JUDGE"]),
  teamId: z.string().optional(), playerId: z.string().optional(), value: z.string().max(300).optional(), index: z.number().int().min(0).max(100).optional(), seconds: z.number().int().min(0).max(180).optional(),
}) });
