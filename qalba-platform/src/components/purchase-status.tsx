"use client";
import Link from "next/link";
import { useState } from "react";
export function PurchaseStatus({ id, initial }: { id: string; initial: string }) {
  const [status, setStatus] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function check() { setBusy(true); setError(""); try { const response = await fetch(`/api/billing/purchases/${id}`, { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "تعذّر التحقق"); setStatus(result.status); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر التحقق"); } finally { setBusy(false); } }
  return <section className="panel auth-card"><h2>{status === "PAID" ? "اكتمل الشراء وأضيف الرصيد" : ["FAILED", "CANCELED", "EXPIRED", "VOIDED"].includes(status) ? "لم يكتمل الدفع" : "جاري انتظار تأكيد الدفع"}</h2>
    {error && <p role="alert">{error}</p>}{status === "PENDING" && <button className="btn btn-primary" disabled={busy} onClick={() => void check()}>{busy ? "جاري التحقق..." : "تحقق من الدفع"}</button>}
    <div className="utility-links"><Link href="/profile" className="btn btn-secondary">عرض رصيدي</Link><Link href="/pricing" className="btn btn-secondary">الباقات</Link></div></section>;
}
