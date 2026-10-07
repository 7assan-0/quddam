import { contentText } from "@/lib/content/rules";
import {z} from "zod";
import {validCard} from "./module";
export const setupSchema=z.object({names:z.tuple([z.string().trim().min(2).max(60),z.string().trim().min(2).max(60)])}).strict();
export const commandSchema=z.object({key:z.string().uuid(),expectedVersion:z.number().int().nonnegative(),action:z.object({type:z.enum(["START","PREPARE_ROUND","START_ROUND","CORRECT","SKIP","FOUL","END_ROUND","NEXT_ROUND","PAUSE","RESUME","UNDO","COMPLETE","REMATCH","ABANDON"])}).strict()}).strict();
export const cardSchema=z.object({targetWord:contentText(1, 100),forbiddenWords:z.array(contentText(1, 100)).min(3).max(6),categoryId:z.string().min(1).max(100),difficulty:z.enum(["EASY","MEDIUM","HARD"]),locale:z.literal("ar-SA"),status:z.enum(["DRAFT","PUBLISHED","ARCHIVED"])}).strict().refine(validCard,{message:"أضف ٣–٦ كلمات ممنوعة مختلفة؛ لا تكرّر الكلمة المستهدفة أو كلمة بعد التطبيع",path:["forbiddenWords"]});
