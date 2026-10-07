import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { adminMetrics } from "@/lib/admin/metrics";
import { analyticsSince } from "@/lib/admin/metric-policy";
import { eventNames } from "@/lib/analytics/events";

export default async function AdminAnalytics() {
  const admin = await requireUser(); if (admin.role !== "ADMIN") notFound();
  const now = new Date(), since = analyticsSince(now);
  const [metrics, reported, mostUsed, events] = await Promise.all([
    adminMetrics(),
    db().questionReport.groupBy({ by: ["reason"], _count: { _all: true } }),
    db().sessionQuestion.groupBy({ by: ["questionId"], _count: { _all: true }, orderBy: { _count: { questionId: "desc" } }, take: 10 }),
    db().analyticsEvent.groupBy({ by: ["name"], where: { occurredAt: { gte: since, lte: now } }, _count: { _all: true } }),
  ]);
  const questions = await db().question.findMany({ where: { id: { in: mostUsed.map(item => item.questionId) } }, select: { id: true, question: true } });
  return <div className="shell"><div className="page-title"><span className="eyebrow">قراءة الأداء</span><h1>التحليلات</h1><p>الأحداث لآخر 30 يومًا كمدة زمنية متصلة. عدادات الجلسات والمحتوى أدناه تراكمية؛ الاحتفاظ يستثني التدقيق المالي.</p></div><div className="utility-links"><Link className="btn btn-secondary" href="/admin">لوحة الإدارة</Link></div>
    <div className="admin-grid"><div className="panel"><div className="stat">{metrics.games}</div><h3>كل الجلسات المنشأة</h3></div><div className="panel"><div className="stat">{metrics.today}</div><h3>اليوم بتوقيت السعودية</h3></div><div className="panel"><div className="stat">{metrics.usage}</div><h3>اختيارات محتوى محفوظة</h3></div><div className="panel"><div className="stat">{metrics.reports}</div><h3>بلاغات مفتوحة</h3></div></div>
    <div className="profile-grid section"><div className="panel"><h2>الأحداث خلال 30 يومًا</h2>{eventNames.map(name => <p key={name}>{name}: {events.find(item => item.name === name)?._count._all ?? 0}</p>)}<h2>الألعاب الشائعة</h2>{metrics.popularGames.map(item => <p key={item.title}>{item.title}: {item.total} جلسة</p>)}{!metrics.popularGames.length && <p className="muted">لا توجد بيانات بعد.</p>}<h2>الفئات الأكثر اختيارًا للمحتوى</h2>{metrics.popularCategories.map(item => <p key={item.title}>{item.title}: {item.total} اختيار محتوى</p>)}</div>
    <div className="panel"><h2>أسئلة لوحة التحدي والسجل العام الأقدم فقط</h2>{mostUsed.map(item => <p key={item.questionId}>{questions.find(q => q.id === item.questionId)?.question ?? "سؤال محذوف"} · {item._count._all}</p>)}{!mostUsed.length && <p className="muted">لا توجد اختيارات محتوى محفوظة بعد.</p>}<h2>أسباب البلاغات</h2>{reported.map(item => <p key={item.reason}>{item.reason}: {item._count._all}</p>)}{!reported.length && <p className="muted">لا توجد بلاغات بعد.</p>}</div></div>
  </div>;
}
