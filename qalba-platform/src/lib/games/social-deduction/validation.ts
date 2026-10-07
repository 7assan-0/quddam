import { contentText, uniqueContent } from "@/lib/content/rules";
import { z } from "zod";
const host = ["START", "BEGIN_DISCUSSION", "ADVANCE_TURN", "BEGIN_VOTING", "CLOSE_VOTING", "PAUSE", "RESUME", "END_GAME", "COMPLETE", "REMATCH", "FINISH_TURN", "EXPIRE_GUESS"] as const;
export const socialCommandSchema = z.object({ key: z.string().uuid(), expectedVersion: z.number().int().nonnegative(),
  action: z.union([z.object({ type: z.enum(host) }), z.object({ type: z.literal("SUBMIT_VOTE"), roundId: z.string().min(1).max(100), ballot: z.number().int().positive(), targetId: z.string().min(1).max(100) }),
    z.object({ type: z.literal("REMOVE_PARTICIPANT"), targetId: z.string().min(1).max(100) }),
    z.object({ type: z.literal("SUBMIT_GUESS"), guess: z.string().trim().min(1).max(100) })]) });
export const wordSchema = z.object({ word: contentText(2, 100), categoryId: z.string().min(1), difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  alternativeAnswers: z.array(contentText(1, 100)).max(12).default([]), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("PUBLISHED") }).refine(v => uniqueContent([v.word, ...v.alternativeAnswers]), {message:"الكلمة والبدائل يجب أن تكون مختلفة بعد التطبيع", path:["alternativeAnswers"]});
