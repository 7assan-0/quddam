"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function CreditManager({ count, enabled }: { count: number; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pendingGrant = useRef<{ key: string; email: string; amount: number } | null>(null);

  async function send(url: string, method: "PATCH" | "POST", body: object) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "تعذّر حفظ الطلب");
      setMessage(method === "PATCH" ? "حُفظ رصيد البداية للحسابات الجديدة" : result.duplicate ? "هذه المنحة مسجلة بالفعل" : `أُضيف الرصيد إلى ${result.name}. الرصيد الحالي: ${result.balance}`);
      router.refresh();
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر حفظ الطلب"); return false; }
    finally { setBusy(false); }
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void send("/api/admin/credits/settings", "PATCH", { count: Number(data.get("count")), enabled: data.get("enabled") === "on" });
  }
  function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const email = String(data.get("email")); const amount = Number(data.get("amount"));
    if (!pendingGrant.current || pendingGrant.current.email !== email || pendingGrant.current.amount !== amount) {
      pendingGrant.current = { email, amount, key: crypto.randomUUID() };
    }
    void send("/api/admin/credits/grants", "POST", pendingGrant.current).then((success) => {
      if (success) { pendingGrant.current = null; if (form.isConnected) form.reset(); }
    });
  }

  return <div className="profile-grid"><section className="panel"><h2>رصيد البداية</h2><p className="muted">ينطبق الإعداد على الحسابات التي لم تحصل على رصيد البداية بعد. لا يغير أرصدة الحسابات السابقة.</p><form onSubmit={saveSettings}><div className="field"><label htmlFor="welcome-count">عدد الألعاب</label><input className="input" id="welcome-count" type="number" name="count" defaultValue={count} min="0" max="20" required /></div><div className="field"><label className="check-field"><input type="checkbox" name="enabled" defaultChecked={enabled} /> تفعيل رصيد البداية</label></div><button className="btn btn-primary" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ الإعداد"}</button></form></section>
    <section className="panel"><h2>منح رصيد لحساب</h2><p className="muted">أضف ألعابًا إلى حساب مسجل. العملية تسجل باسم المسؤول ولا تقبل رصيدًا سالبًا.</p><form onSubmit={grant}><div className="field"><label htmlFor="grant-email">بريد الحساب</label><input className="input" id="grant-email" name="email" type="email" dir="ltr" required /></div><div className="field"><label htmlFor="grant-amount">عدد الألعاب</label><input className="input" id="grant-amount" name="amount" type="number" min="1" max="100" defaultValue="1" required /></div><button className="btn btn-secondary" disabled={busy}>{busy ? "جارٍ الإضافة..." : "إضافة الرصيد"}</button></form></section>
    {(error || message) && <div className={error ? "form-error" : "form-success"} role={error ? "alert" : "status"}>{error || message}</div>}
  </div>;
}
