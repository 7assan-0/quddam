"use client";
import { Brand } from "./brand";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "login" | "register" | "forgot" | "reset";

export function AuthForm({ mode, token }: { mode: Mode; token?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const title = { login: "رجعت لنا؟", register: "خلّ لك مكان", forgot: "استعادة كلمة المرور", reset: "كلمة مرور جديدة" }[mode];
  const button = { login: "تسجيل الدخول", register: "إنشاء الحساب", forgot: "إرسال رابط الاستعادة", reset: "حفظ كلمة المرور" }[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "reset" ? { ...data, token } : data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "تعذّر إكمال الطلب");
      if (mode === "forgot") setSuccess("إذا كان البريد مسجلًا، سيصلك رابط خلال دقائق.");
      else if (mode === "reset") { setSuccess("تم تحديث كلمة المرور. يمكنك الدخول الآن."); }
      else { router.push("/games"); router.refresh(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر إكمال الطلب"); }
    finally { setBusy(false); }
  }

  return <div className="auth-wrap shell"><div className="auth-card panel"><Brand/><h1>{title}</h1><p className="auth-welcome">{mode === "register" ? "حساب واحد للمضيف، وتحديات تجمع جماعتك." : mode === "login" ? "حيّاك. لعبتكم الجاية تنتظرك." : "نرجّعك لحسابك بخطوات بسيطة."}</p>
    <form onSubmit={submit}>
      {mode === "register" && <div className="field"><label htmlFor="name">الاسم</label><input className="input" id="name" name="name" autoComplete="name" minLength={2} maxLength={80} required /></div>}
      {mode !== "reset" && <div className="field"><label htmlFor="email">البريد الإلكتروني</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>}
      {(mode === "register" || mode === "login" || mode === "reset") && <div className="field"><label htmlFor="password">كلمة المرور</label><input className="input" id="password" name="password" type="password" autoComplete={mode === "register" || mode === "reset" ? "new-password" : "current-password"} minLength={mode === "login" ? 1 : 12} maxLength={128} required />{mode !== "login" && <small className="form-note">١٢ حرفًا على الأقل</small>}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}
      <button className="btn btn-primary" style={{ width: "100%" }} type="submit" disabled={busy || (mode === "reset" && !token)}>{busy ? "لحظة..." : button}</button>
    </form>
    <div className="form-row" style={{ marginTop: 22 }}>
      {mode === "login" && <><Link className="subtle-link" href="/register">حساب جديد</Link><Link className="subtle-link" href="/forgot-password">نسيت كلمة المرور؟</Link></>}
      {mode === "register" && <><span className="muted">عندك حساب؟</span><Link className="subtle-link" href="/login">سجّل دخولك</Link></>}
      {(mode === "forgot" || mode === "reset") && <Link className="subtle-link" href="/login">العودة لتسجيل الدخول</Link>}
    </div>
  </div></div>;
}
