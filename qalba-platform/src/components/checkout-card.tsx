"use client";
import { useState } from "react";
export function CheckoutCard({ id, title, credits, price, configured }: { id: string; title: string; credits: number; price: number; configured: boolean }) {
  const [coupon, setCoupon] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function buy() { setBusy(true); setError("");
    try { const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: id, couponCode: coupon || undefined, key: crypto.randomUUID() }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "تعذّر بدء الشراء"); if (!result.url) throw new Error("رابط الدفع غير متاح"); window.location.assign(result.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر بدء الشراء"); setBusy(false); } }
  return <article className="panel info-card"><h2>{title}</h2><strong className="stat">{credits} ألعاب</strong><p>{new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(price / 100)}</p>
    <label htmlFor={`coupon-${id}`}>قسيمة خصم (اختياري)</label><input className="input" id={`coupon-${id}`} value={coupon} maxLength={40} onChange={event => setCoupon(event.target.value)} />
    {error && <p role="alert" className="form-error">{error}</p>}{!configured && <p className="muted">الدفع بانتظار تهيئة بوابة المزود.</p>}<button className="btn btn-primary" disabled={busy || !configured} onClick={() => void buy()}>{busy ? "جاري فتح الدفع..." : "شراء الرصيد"}</button></article>;
}
