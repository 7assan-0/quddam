import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { FeatureManager } from "@/components/feature-manager";

export default async function AdminFeatures() {
  const admin = await requireUser(); if (admin.role !== "ADMIN") notFound();
  const flags = await db().featureFlag.findMany({ where: { key: { not: "welcome-credits" } }, orderBy: { key: "asc" } });
  return <div className="shell"><div className="page-title"><span className="eyebrow">الإعدادات</span><h1>مفاتيح الميزات</h1><p>إعدادات الميزات المستقبلية تُحفظ هنا. المفتاح لا يفعّل سلوكًا جديدًا قبل ربطه في محرك اللعبة أو الواجهة.</p></div><div className="utility-links"><Link className="btn btn-secondary" href="/admin">لوحة الإدارة</Link><Link className="btn btn-secondary" href="/admin/credits">رصيد البداية</Link></div><FeatureManager flags={flags} /></div>;
}
