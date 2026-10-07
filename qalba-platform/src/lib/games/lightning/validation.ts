import { hasInvalidAuthoredText } from "@/lib/content/authored";
import { z } from "zod";
import { bounded, validateQuestion } from "./module";
const text = (max: number) => z.string().max(max).transform((v, c) => { try { return bounded(v, max); } catch (e) { c.addIssue({ code: "custom", message: e instanceof Error ? e.message : "نص غير صالح" }); return z.NEVER; } });
export const questionSchema = z.object({ question: text(500), answer: text(160), alternativeAnswers: z.array(text(160)).max(12), categoryId: z.string().min(1).max(100), difficulty: z.enum(["EASY", "MEDIUM", "HARD"]), locale: z.literal("ar-SA"), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]), explanation: z.union([text(1000), z.literal(""), z.null()]).transform(v => v || null) }).strict().refine(v => !hasInvalidAuthoredText(v), "راجع محتوى النص قبل النشر").superRefine((q, c) => { try { validateQuestion({ ...q, category: "فئة" }); } catch (e) { c.addIssue({ code: "custom", message: e instanceof Error ? e.message : "سؤال غير صالح" }); } });
export const createSchema = z.object({ teams: z.tuple([text(60), text(60)]) }).strict().refine(v => v.teams.every(n => n.length >= 2) && v.teams[0] !== v.teams[1], "اختر اسمين مختلفين للفريقين");
export const commandSchema = z.object({ key: z.uuid(), expectedVersion: z.number().int().nonnegative(), action: z.object({ type: z.enum(["START", "PREPARE_QUESTION", "OPEN_BUZZ", "CORRECT", "WRONG", "STEAL_CORRECT", "STEAL_WRONG", "NEXT_QUESTION", "PAUSE", "RESUME", "UNDO", "VOID_RESULT", "END_GAME", "COMPLETE", "REMATCH", "ABANDON"]) }).strict() }).strict();
export const buzzSchema = z.object({ key: z.uuid(), expectedVersion: z.number().int().nonnegative() }).strict();
export const accessSchema = z.object({ teamId: z.string().min(1).max(100) }).strict();
