import { formatNumber } from "@/lib/format-number";
"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Product = { id: string; slug: string; title: string; credits: number; priceHalalas: number; active: boolean; currency: string };
type Coupon = { id: string; code: string; discountPercent: number | null; discountHalalas: number | null; maxUses: number | null; usedCount: number; expiresAt: string | null; active: boolean };
function localDateTime(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso); const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function PricingManager({ products, coupons }: { products: Product[]; coupons: Coupon[] }) {
  const router = useRouter(); const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [version, setVersion] = useState(0);
  async function save(url: string, method: "POST" | "PATCH", payload: object) {
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "تعذّر حفظ البيانات");
      setSelectedProduct(null); setSelectedCoupon(null); setVersion(value => value + 1); setSuccess("حُفظت البيانات"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الحفظ"); }
    finally { setBusy(false); }
  }
  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void save(selectedProduct ? `/api/admin/products/${selectedProduct.id}` : "/api/admin/products", selectedProduct ? "PATCH" : "POST",
      { slug: data.get("slug"), title: data.get("title"), credits: Number(data.get("credits")), priceHalalas: Math.round(Number(data.get("riyals")) * 100), active: data.get("active") === "on" });
  }
  function submitCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const percent = String(data.get("discountPercent") || ""); const halalas = String(data.get("discountRiyals") || ""); const max = String(data.get("maxUses") || ""); const expires = String(data.get("expiresAt") || "");
    void save(selectedCoupon ? `/api/admin/coupons/${selectedCoupon.id}` : "/api/admin/coupons", selectedCoupon ? "PATCH" : "POST",
      { code: data.get("code"), discountPercent: percent ? Number(percent) : null, discountHalalas: halalas ? Math.round(Number(halalas) * 100) : null,
        maxUses: max ? Number(max) : null, expiresAt: expires ? new Date(expires).toISOString() : null, active: data.get("active") === "on" });
  }
  return <><div className="profile-grid"><section className="panel"><h2>{selectedProduct ? "تعديل الباقة" : "باقة جديدة"}</h2><form key={`product-${selectedProduct?.id ?? "new"}-${version}`} onSubmit={submitProduct}>
    <div className="field"><label htmlFor="product-title">اسم الباقة</label><input className="input" id="product-title" name="title" defaultValue={selectedProduct?.title ?? ""} minLength={2} maxLength={100} required /></div>
    <div className="field"><label htmlFor="product-slug">رمز الباقة</label><input className="input" id="product-slug" name="slug" dir="ltr" pattern="[a-z0-9-]{2,80}" defaultValue={selectedProduct?.slug ?? ""} required /></div>
    <div className="form-row"><div className="field"><label htmlFor="product-credits">عدد الألعاب</label><input className="input" id="product-credits" name="credits" type="number" min="1" max="1000" defaultValue={selectedProduct?.credits ?? 1} required /></div><div className="field"><label htmlFor="product-price">السعر بالريال</label><input className="input" id="product-price" name="riyals" type="number" step="0.01" min="1" max="100000" defaultValue={selectedProduct ? selectedProduct.priceHalalas / 100 : ""} required /></div></div>
    <label className="check-field"><input type="checkbox" name="active" defaultChecked={selectedProduct?.active ?? false} /> تفعيل الباقة عند إطلاق الدفع</label><div className="utility-links"><button className="btn btn-primary" disabled={busy}>حفظ الباقة</button>{selectedProduct && <button type="button" className="btn btn-secondary" onClick={() => setSelectedProduct(null)}>إلغاء</button>}</div></form>
    <div className="item-list">{products.map(product => <div className="item" key={product.id}><div><h3>{product.title}</h3><p>{product.credits} ألعاب · {formatNumber(product.priceHalalas / 100, { style: "currency", currency: "SAR" })} · {product.active ? "مفعلة" : "معطلة"}</p></div><button className="btn btn-secondary btn-small" onClick={() => setSelectedProduct(product)}>تعديل</button></div>)}{products.length === 0 && <div className="empty">لا توجد باقات.</div>}</div></section>
    <section className="panel"><h2>{selectedCoupon ? "تعديل القسيمة" : "قسيمة جديدة"}</h2><form key={`coupon-${selectedCoupon?.id ?? "new"}-${version}`} onSubmit={submitCoupon}>
      <div className="field"><label htmlFor="coupon-code">الرمز</label><input className="input" id="coupon-code" name="code" dir="ltr" pattern="[A-Za-z0-9-]{3,40}" defaultValue={selectedCoupon?.code ?? ""} required /></div>
      <p className="form-note">املأ حقل خصم واحدًا فقط: نسبة أو مبلغ.</p><div className="form-row"><div className="field"><label htmlFor="coupon-percent">نسبة الخصم %</label><input className="input" id="coupon-percent" name="discountPercent" type="number" min="1" max="100" defaultValue={selectedCoupon?.discountPercent ?? ""} /></div><div className="field"><label htmlFor="coupon-fixed">خصم بالريال</label><input className="input" id="coupon-fixed" name="discountRiyals" type="number" step="0.01" min="0.01" defaultValue={selectedCoupon?.discountHalalas ? selectedCoupon.discountHalalas / 100 : ""} /></div></div>
      <div className="field"><label htmlFor="coupon-limit">الحد الأقصى للاستخدامات (اختياري)</label><input className="input" id="coupon-limit" name="maxUses" type="number" min="1" defaultValue={selectedCoupon?.maxUses ?? ""} /></div>
      <div className="field"><label htmlFor="coupon-expires">انتهاء الصلاحية (اختياري)</label><input className="input" id="coupon-expires" name="expiresAt" type="datetime-local" defaultValue={localDateTime(selectedCoupon?.expiresAt ?? null)} /></div>
      <label className="check-field"><input type="checkbox" name="active" defaultChecked={selectedCoupon?.active ?? false} /> مفعلة عند إطلاق الدفع</label><div className="utility-links"><button className="btn btn-primary" disabled={busy}>حفظ القسيمة</button>{selectedCoupon && <button type="button" className="btn btn-secondary" onClick={() => setSelectedCoupon(null)}>إلغاء</button>}</div></form>
      <div className="item-list">{coupons.map(coupon => <div className="item" key={coupon.id}><div><h3 dir="ltr">{coupon.code}</h3><p>{coupon.discountPercent ? `${coupon.discountPercent}%` : `${(coupon.discountHalalas ?? 0) / 100} ر.س`} · {coupon.usedCount} استخدام · {coupon.active ? "مفعلة" : "معطلة"}</p></div><button className="btn btn-secondary btn-small" onClick={() => setSelectedCoupon(coupon)}>تعديل</button></div>)}{coupons.length === 0 && <div className="empty">لا توجد قسائم.</div>}</div>
    </section></div>{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}</>;
}
