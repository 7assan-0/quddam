import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

const datasets = [["users", "الحسابات والأرصدة"], ["categories", "الفئات"], ["games", "المباريات والنتائج"], ["purchases", "المشتريات"], ["reports", "بلاغات الأسئلة"]] as const;
export default async function AdminExports() {
  const admin = await requireUser(); if (admin.role !== "ADMIN") notFound();
  return <div className="shell"><div className="page-title"><span className="eyebrow">البيانات</span><h1>تصدير CSV</h1><p>ملفات UTF-8 مناسبة لفتحها في Excel. البيانات خاصة بالإدارة وتتضمن البريد الإلكتروني في بعض الملفات. الحد ١٠٬٠٠٠ سجل لكل مجموعة.</p></div><div className="utility-links"><Link className="btn btn-secondary" href="/admin">لوحة الإدارة</Link></div><div className="admin-grid">{datasets.map(([key, title]) => <div className="panel" key={key}><h3>{title}</h3><a className="btn btn-secondary" href={`/api/admin/export?dataset=${key}`} download={`qalba-${key}.csv`}>تنزيل CSV</a></div>)}<div className="panel"><h3>بنك الأسئلة</h3><a className="btn btn-secondary" href="/api/admin/questions/export" download="qalba-questions.csv">تنزيل CSV</a></div></div></div>;
}
