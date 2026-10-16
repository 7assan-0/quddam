"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
export function ShillatakJoin({ code, name, open, alreadyMember, shillaId }: {
  code: string; name: string; open: boolean; alreadyMember: boolean; shillaId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const inFlight = useRef(false);
  async function accept() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/shillatak/join/${encodeURIComponent(code)}`, {
        method: "POST", credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "تعذر قبول الدعوة"); return; }
      router.replace(`/shillatak/${data.shillaId}`);
    } catch { setError("تعذر الاتصال. اقرأ حالة الرابط قبل المحاولة مجددًا."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="shell" data-testid="shillatak-join">
    <div className="page-title"><span className="eyebrow">عضوية خاصة</span><h1>دعوة للانضمام إلى شلّة</h1></div>
    <section className="panel"><h2>{name}</h2><p>قبول الدعوة يُظهر اسم حسابك لبقية أعضاء الشلّة، ويمكنك مغادرتها لاحقًا إن لم تكن المالك.</p>
      {alreadyMember ? <><p>أنت عضو مسبقًا في هذه الشلّة.</p>{shillaId &&
        <Link className="btn btn-primary" href={`/shillatak/${encodeURIComponent(shillaId)}`}>دخول الشلّة</Link>}</> :
        open ? <button className="btn btn-primary" disabled={busy} onClick={() => void accept()}>
          {busy ? "جارٍ الانضمام…" : "قبول الدعوة"}</button> :
          <p>الدعوة غير متاحة أو انتهت أو استُخدمت.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="utility-links"><Link className="btn btn-secondary" href="/shillatak">شللي الخاصة</Link></div>
    </section>
  </div>;
}
