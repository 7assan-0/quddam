"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Preview = { total: number; valid: number; errors: { row: number; message: string }[] };
export function QuestionImport() {
  const router = useRouter(); const [csv, setCsv] = useState(""); const [name, setName] = useState(""); const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function run(dryRun: boolean) {
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/admin/questions/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, dryRun }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? result.errors?.[0]?.message ?? "تعذّر معالجة الملف");
      if (dryRun) setPreview(result); else { setSuccess(`أُضيف ${result.created} سؤالًا`); setCsv(""); setName(""); setPreview(null); router.refresh(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر معالجة الملف"); }
    finally { setBusy(false); }
  }
  return <section className="panel question-import"><h2>استيراد وتصدير الأسئلة</h2><p className="muted">ملف CSV بترميز UTF-8، حتى 250 سؤالًا و500 كيلوبايت في الدفعة. يمكن فتح ملف التصدير وتحريره في Excel ثم حفظه بصيغة CSV UTF-8.</p>
    <div className="form-row"><label className="btn btn-secondary" htmlFor="csv-file" aria-disabled={!ready}>اختيار ملف CSV</label><input className="visually-hidden" id="csv-file" type="file" accept=".csv,text/csv" disabled={!ready} onChange={async event => { const file = event.target.files?.[0]; setError(""); setSuccess(""); setPreview(null);
      if (!file) return; if (file.size > 500_000) { setError("الملف أكبر من 500 كيلوبايت"); return; } setName(file.name); setCsv(await file.text()); }} />
      {name && <span>{name}</span>}<button className="btn btn-primary" type="button" disabled={busy || !csv} onClick={() => void run(true)}>{busy ? "جارٍ الفحص..." : "معاينة الملف"}</button><a className="btn btn-secondary" href="/api/admin/questions/export" download="qalba-questions.csv">تصدير CSV</a></div>
    {preview && <div className="form-note" role="status"><p>{preview.total} صف · {preview.valid} صالح · {preview.errors.length} أخطاء</p>{preview.errors.length ? <ul>{preview.errors.slice(0, 25).map((item, index) => <li key={index}>الصف {item.row}: {item.message}</li>)}</ul> : <button className="btn btn-primary" disabled={busy || !preview.valid} onClick={() => void run(false)}>استيراد {preview.valid} سؤالًا</button>}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}
  </section>;
}
