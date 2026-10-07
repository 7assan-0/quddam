import nodemailer from "nodemailer";

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendResetMail(to: string, token: string) {
  if (!mailConfigured()) throw new Error("SMTP is not configured");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  const origin = process.env.APP_URL;
  if (!origin) throw new Error("APP_URL is not configured");
  const url = new URL("/reset-password", origin);
  url.searchParams.set("token", token);
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "استعادة كلمة المرور | قدّام",
    text: `طلبت إعادة تعيين كلمة المرور. افتح الرابط خلال 30 دقيقة: ${url.toString()}\nإذا لم تطلب ذلك، تجاهل الرسالة.`,
  });
}
