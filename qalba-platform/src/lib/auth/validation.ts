import { z } from "zod";

export const emailSchema = z.email().max(320).transform((email) => email.trim().toLowerCase());
export const passwordSchema = z.string().min(12, "كلمة المرور ١٢ حرفًا على الأقل").max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ token: z.string().min(30).max(100), password: passwordSchema });
