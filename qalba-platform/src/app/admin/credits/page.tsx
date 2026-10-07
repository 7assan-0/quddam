import Link from "next/link";
import { saudiDate as date } from "@/lib/admin/metric-policy";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { CreditManager } from "@/components/credit-manager";

export default async function AdminCredits() {
  const admin = await requireUser();
  if (admin.role !== "ADMIN") notFound();
  const [setting, grants] = await Promise.all([
    db().featureFlag.findUnique({ where: { key: "welcome-credits" } }),
    db().gameCredit.findMany({ where: { reason: "منحة المسؤول" }, include: { user: { select: { email: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const count = typeof setting?.config === "object" && setting.config && !Array.isArray(setting.config) &&
    typeof setting.config.count === "number" ? setting.config.count : 0;
  return <div className="shell"><div className="page-title"><span className="eyebrow">إدارة المحفظة</span><h1>رصيد الألعاب</h1><p>حدد رصيد الحسابات الجديدة، أو امنح ألعابًا لحساب بعينه. تسجل كل حركة في دفتر الرصيد.</p></div>
    <div className="utility-links"><Link className="btn btn-secondary" href="/admin">لوحة الإدارة</Link><Link className="btn btn-secondary" href="/admin/questions">الأسئلة</Link></div>
    <CreditManager count={count} enabled={setting?.enabled ?? false} />
    <section className="section"><div className="section-head"><div><span className="eyebrow">آخر الحركات</span><h2>منح الرصيد</h2></div></div>{grants.length === 0 ? <div className="empty">لا توجد منح إدارية حتى الآن.</div> : <div className="history-list">{grants.map(grant => <div className="panel ledger-row" key={grant.id}><span>{grant.user.name} · <b dir="ltr">{grant.user.email}</b><small className="muted">{date(grant.createdAt)}</small></span><strong className="positive" dir="ltr">+{grant.delta}</strong></div>)}</div>}</section>
  </div>;
}
