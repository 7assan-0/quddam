import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { CheckoutCard } from "@/components/checkout-card";
export default async function PricingPage() { await requireUser(); const products = await db().product.findMany({ where: { active: true, currency: "SAR" }, orderBy: { credits: "asc" } });
  const configured = Boolean(process.env.MOYASAR_SECRET_KEY && (process.env.MOYASAR_CALLBACK_TOKEN?.length ?? 0) >= 32);
  return <div className="shell section"><div className="page-title"><span className="eyebrow">رصيد الألعاب</span><h1>اختاروا باقة جمعتكم</h1><p>تُسعر الباقات من لوحة الإدارة. الدفع يتم على صفحة مزود آمنة، وتضاف الألعاب بعد تأكيد الفاتورة.</p></div>
    {products.length ? <div className="info-grid">{products.map(product => <CheckoutCard key={product.id} id={product.id} title={product.title} credits={product.credits} price={product.priceHalalas} configured={configured} />)}</div> : <div className="empty">لا توجد باقات متاحة الآن.</div>}
    <div className="utility-links"><Link className="btn btn-secondary" href="/profile">رصيدي ومشترياتي</Link></div></div>;
}
