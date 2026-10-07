"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Report = { id: string; reason: string; details: string | null; status: string; createdAt: string;
  question: { question: string; answer: string; status: string }; user: { name: string; email: string } };
const reasons: Record<string, string> = { WRONG_ANSWER: "الإجابة خاطئة", OUTDATED: "قديم", DUPLICATE: "مكرر", UNCLEAR: "غير واضح", SPELLING: "خطأ إملائي", INAPPROPRIATE: "غير مناسب", OTHER: "سبب آخر" };
export function ReportManager({ reports }: { reports: Report[] }) {
  const router = useRouter(); const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  async function review(id: string, status: string, archiveQuestion = false) {
    if (archiveQuestion && !window.confirm("أرشفة السؤال ومنع ظهوره في مباريات جديدة؟")) return;
    setBusy(id); setError("");
    try { const response = await fetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, archiveQuestion }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "تعذّر مراجعة البلاغ"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر التحديث"); }
    finally { setBusy(""); }
  }
  return <div className="history-list">{error && <p className="form-error" role="alert">{error}</p>}{reports.map(report => <article className="panel" key={report.id}><span className="eyebrow">{reasons[report.reason]} · {report.status}</span><h3>{report.question.question}</h3><p>الإجابة المسجلة: <b>{report.question.answer}</b> · {report.question.status === "ARCHIVED" ? "مؤرشف" : "ظاهر في بنك الأسئلة"}</p>{report.details && <p className="muted">ملاحظة اللاعب: {report.details}</p>}<p className="muted">{report.user.name} · <b dir="ltr">{report.user.email}</b> · {new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeZone: "Asia/Riyadh" }).format(new Date(report.createdAt))}</p>
    <div className="utility-links"><button className="btn btn-secondary btn-small" disabled={Boolean(busy)} onClick={() => review(report.id, "REVIEWING")}>قيد المراجعة</button><button className="btn btn-secondary btn-small" disabled={Boolean(busy)} onClick={() => review(report.id, "RESOLVED")}>تمت المعالجة</button><button className="btn btn-danger btn-small" disabled={Boolean(busy) || report.question.status === "ARCHIVED"} onClick={() => review(report.id, "RESOLVED", true)}>معالجة وأرشفة السؤال</button><button className="btn btn-secondary btn-small" disabled={Boolean(busy)} onClick={() => review(report.id, "DISMISSED")}>استبعاد البلاغ</button></div></article>)}{reports.length === 0 && <div className="empty">لا توجد بلاغات بعد.</div>}</div>;
}
