import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ReportManager } from "@/components/report-manager";

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const admin = await requireUser(); if (admin.role !== "ADMIN") notFound();
  const page = Math.min(10000, Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1));
  const [reports, count] = await Promise.all([
    db().questionReport.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30,
      include: { question: { select: { question: true, answer: true, status: true } }, user: { select: { name: true, email: true } } } }),
    db().questionReport.count(),
  ]);
  return <div className="shell"><div className="page-title"><span className="eyebrow">مراجعة المحتوى</span><h1>بلاغات الأسئلة</h1><p>راجع السبب والإجابة، ثم حدّد حالة البلاغ. أرشفة السؤال تمنع ظهوره في مباريات جديدة ولا تغيّر مباراة بدأت بالفعل.</p></div><div className="utility-links"><Link className="btn btn-secondary" href="/admin">لوحة الإدارة</Link><Link className="btn btn-secondary" href="/admin/questions">بنك الأسئلة</Link></div><ReportManager reports={reports.map(report => ({ ...report, createdAt: report.createdAt.toISOString() }))} />
    <div className="utility-links"><span className="muted">{count} بلاغ · صفحة {page}</span>{page > 1 && <Link className="btn btn-secondary btn-small" href={`/admin/reports?page=${page - 1}`}>السابق</Link>}{page * 30 < count && <Link className="btn btn-secondary btn-small" href={`/admin/reports?page=${page + 1}`}>التالي</Link>}</div>
  </div>;
}
