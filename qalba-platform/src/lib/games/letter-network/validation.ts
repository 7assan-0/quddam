import { contentText } from "@/lib/content/rules";
import { z } from "zod";
import { normalizeArabic, validQuestionLetter } from "./module";
export const setupSchema=z.object({names:z.tuple([z.string().trim().min(2).max(60),z.string().trim().min(2).max(60)])}).strict();
export const commandSchema=z.object({key:z.string().uuid(),expectedVersion:z.number().int().nonnegative(),action:z.union([
  z.object({type:z.enum(["START","OPEN_QUESTION","REVEAL_ANSWER","CORRECT","WRONG","STEAL_CORRECT","STEAL_WRONG","EXPIRE_ANSWER","PAUSE","RESUME","UNDO","COMPLETE","END_GAME","ABANDON","REMATCH"])}).strict(),
  z.object({type:z.literal("SELECT_CELL"),cellId:z.string().regex(/^r[0-4]c[0-4]$/)}).strict()
])}).strict();
export const letterQuestionSchema=z.object({letter:z.string().trim().max(4).transform(normalizeArabic),question:contentText(8, 2000),
  answer:contentText(1, 200),alternativeAnswers:z.array(contentText(1, 200)).max(12).default([]),
  difficulty:z.enum(["EASY","MEDIUM","HARD"]),categoryId:z.string().min(1).max(100),status:z.enum(["DRAFT","PUBLISHED","ARCHIVED"]).default("PUBLISHED")}).strict()
  .refine(q=>validQuestionLetter(q.letter,[q.answer,...q.alternativeAnswers]),{message:"الإجابة وكل البدائل يجب أن تبدأ بالحرف المحدد بعد التطبيع",path:["answer"]});

