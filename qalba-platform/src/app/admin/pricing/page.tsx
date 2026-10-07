import Link from "next/link";
import { saudiDate as date } from "@/lib/admin/metric-policy";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PricingManager } from "@/components/pricing-manager";

export default async function AdminPricing() {
  const admin = await requireUser(); if (admin.role !== "ADMIN") notFound();
  const [products, coupons, purchases] = await Promise.all([
    db().product.findMany({ orderBy: { slug: "asc" } }),
    db().coupon.findMany({ orderBy: { code: "asc" } }),
    db().purchase.findMany({ include: { user: { select: { email: true } }, product: { select: { title: true } }, refund: { select: { state: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return <div className="shell"><div className="page-title"><span className="eyebrow">الأسعار</span><h1>الباقات والقسائم</h1><p>الأسعار محفوظة في قاعدة البيانات. تظهر الباقات المفعلة للاعبين، ويحتاج الدفع إلى مفاتيح المزود في بيئة التشغيل.</p></div><div className="utility-links"><Link className="btn btn-secondary" href="/admin">لوحة الإدارة</Link></div>
    <PricingManager products={products} coupons={coupons.map(coupon => ({ ...coupon, expiresAt: coupon.expiresAt?.toISOString() ?? null }))} />
    <section className="section"><div className="section-head"><div><span className="eyebrow">السجل</span><h2>آخر المشتريات</h2></div></div>{purchases.length === 0 ? <div className="empty">لا توجد مشتريات بعد.</div> : <div className="history-list">{purchases.map(purchase => <div className="panel ledger-row" key={purchase.id}><span>{purchase.product.title} · <b dir="ltr">{purchase.user.email}</b><small className="muted">{purchase.status}{purchase.refund ? " · استرداد مؤكد" : ""} · {date(purchase.createdAt)}</small></span><strong>{new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(purchase.amountHalalas / 100)}</strong></div>)}</div>}</section>
  </div>;
}
