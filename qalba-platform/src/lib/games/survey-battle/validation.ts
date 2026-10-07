import { contentText } from "@/lib/content/rules";
import { z } from "zod";
import { validateAnswers } from "./module";
export const setupSchema=z.object({names:z.tuple([z.string().trim().min(2).max(60),z.string().trim().min(2).max(60)])}).strict();
export const commandSchema=z.object({key:z.string().uuid(),expectedVersion:z.number().int().nonnegative(),action:z.union([
  z.object({type:z.enum(["START","START_ROUND","RESET_FACE_OFF","BEGIN_ANSWERING","GUESS_WRONG","START_STEAL","AWARD_ROUND","NEXT_ROUND","UNDO","PAUSE","RESUME","END_GAME","COMPLETE","REMATCH","ABANDON"])}).strict(),
  z.object({type:z.literal("FACE_OFF_GUESS"),teamIndex:z.union([z.literal(0),z.literal(1)]),answerId:z.string().min(1).max(100).nullable()}).strict(),
  z.object({type:z.literal("GUESS_CORRECT"),answerId:z.string().min(1).max(100)}).strict(),
  z.object({type:z.literal("STEAL_GUESS"),answerId:z.string().min(1).max(100).nullable()}).strict()
])}).strict();
export const surveySchema=z.object({question:contentText(8, 2000),categoryId:z.string().min(1).max(100),difficulty:z.enum(["EASY","MEDIUM","HARD"]),status:z.enum(["DRAFT","PUBLISHED","ARCHIVED"]),locale:z.literal("ar-SA"),sourceType:z.literal("CURATED"),
  answers:z.array(z.object({answer:contentText(1, 200),alternativeAnswers:z.array(contentText(1, 200)).max(12),points:z.number().int().min(1).max(1000),position:z.number().int().nonnegative()}).strict()).min(3).max(12)
}).strict().refine(q=>validateAnswers(q.answers),{message:"رتّب ثلاث إجابات على الأقل بنقاط تنازلية، دون تكرار الإجابات أو البدائل بعد التطبيع",path:["answers"]});
