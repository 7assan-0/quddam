"use client";
import { useState, type FormEvent } from "react";

const reasons = [["WRONG_ANSWER", "الإجابة خاطئة"], ["OUTDATED", "قديمة"], ["DUPLICATE", "مكرر"], ["UNCLEAR", "غير واضح"], ["SPELLING", "خطأ إملائي"], ["INAPPROPRIATE", "غير مناسب"], ["OTHER", "سبب آخر"]] as const;
export function QuestionReportForm({ sessionId, questionId }: { sessionId: string; questionId: string }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/questions/reports", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, questionId, reason: data.get("reason"), details: String(data.get("details") || "").trim() || null }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "تعذّر إرسال البلاغ");
      setMessage(result.duplicate ? "سبق أن أرسلت بلاغًا عن هذا السؤال" : "وصل بلاغك للمراجعة. شكرًا لك"); setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر إرسال البلاغ"); }
    finally { setBusy(false); }
  }
  return <div className="question-report">{message ? <p className="form-success" role="status">{message}</p> : <button className="btn btn-secondary btn-small" type="button" onClick={() => setOpen(value => !value)}>{open ? "إغلاق البلاغ" : "بلّغ عن السؤال"}</button>}
    {open && <form className="panel" onSubmit={send}><h3>ما المشكلة في السؤال؟</h3><div className="field"><label htmlFor={`reason-${questionId}`}>السبب</label><select className="input" id={`reason-${questionId}`} name="reason">{reasons.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></div><div className="field"><label htmlFor={`details-${questionId}`}>تفاصيل إضافية (اختياري)</label><textarea className="input" id={`details-${questionId}`} name="details" maxLength={1000} /></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary btn-small" disabled={busy}>{busy ? "جارٍ الإرسال..." : "إرسال البلاغ"}</button></form>}
  </div>;
}
