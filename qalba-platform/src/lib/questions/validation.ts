import { contentText } from "@/lib/content/rules";
import { z } from "zod";

export const categorySchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,100}$/),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).nullable().optional(),
  active: z.boolean().default(true),
});

export const questionSchema = z.object({
  gameTypeId: z.string().min(1),
  categoryId: z.string().min(1),
  subcategory: z.string().trim().max(100).nullable().optional(),
  question: contentText(8, 2000),
  answer: contentText(1, 1000),
  alternativeAnswers: z.array(contentText(1, 200)).max(20).default([]),
  explanation: z.string().trim().max(2000).nullable().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  pointValue: z.number().int().min(1).max(10000),
  type: z.enum(["TEXT", "MULTIPLE_CHOICE", "TRUE_FALSE", "IMAGE", "AUDIO", "RANKING", "SURVEY", "LETTER", "PASSWORD"]),
  options: z.array(contentText(1, 200)).max(8).nullable().optional(),
  imageUrl: z.url().max(2048).refine((url) => {
    const protocol = new URL(url).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "رابط الصورة يجب أن يبدأ بـ http أو https").nullable().optional(),
  source: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default("ar"),
  country: z.string().regex(/^[A-Z]{2,3}$/).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.type === "MULTIPLE_CHOICE" && (!value.options || value.options.length < 3 || !value.options.includes(value.answer))) {
    ctx.addIssue({ code: "custom", message: "الاختيارات يجب أن تتضمن الإجابة وثلاثة خيارات على الأقل", path: ["options"] });
  }
});

export const questionUpdateSchema = questionSchema.safeExtend({ id: z.string().min(1) });
