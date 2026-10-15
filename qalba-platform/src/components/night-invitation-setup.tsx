"use client";

import { useEffect, useState } from "react";

type Summary = { exists: boolean; scheduledAt?: string; timezone?: string;
  coming?: number; declined?: number };
export function NightInvitationSetup({ nightId }: { nightId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scheduled, setScheduled] = useState("");
  const [timezone, setTimezone] = useState("Asia/Riyadh");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Riyadh");
    let active = true;
    void fetch(`/api/night/${nightId}/invitation`, { credentials: "same-origin", cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (active) setSummary(data.invitation); })
      .catch(() => { if (active) setNotice("تعذر قراءة حالة الدعوة؛ حاول تحديث الصفحة."); });
    return () => { active = false; };
  }, [nightId]);
  async function create() {
    if (!scheduled || busy) return;
    const date = new Date(scheduled);
    if (!Number.isFinite(date.getTime())) { setNotice("تحقق من الموعد."); return; }
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/night/${nightId}/invitation`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: date.toISOString(), timezone }),
      });
      const data = await response.json();
      if (!response.ok) { setNotice(data.error ?? "تعذر إنشاء الدعوة."); return; }
      // Intentionally only held in this browser tab; the database stores its hash.
      setLink(new URL(data.invitation.path, location.origin).href);
      setSummary({ exists: true, scheduledAt: data.invitation.scheduledAt,
        timezone: data.invitation.timezone, coming: 0, declined: 0 });
      setNotice("تم إنشاء رابط الدعوة. انسخه الآن واحتفظ به؛ لا يمكن استرجاع نص الرابط من قاعدة البيانات.");
    } catch { setNotice("تعذر إنشاء الدعوة. لا تعاود الطلب قبل تحديث حالة الدعوة."); }
    finally { setBusy(false); }
  }
  return <section className="panel" data-testid="night-invitation-setup" style={{ marginBlock: "1rem" }}>
    <h2>دعوة السهرة · قبل بدء اللعب</h2>
    <p>حدد الموعد وشارك رابط الحضور يدويًا. هذه دعوة تخطيط وتصويت فقط؛ لا تفتح غرفة اللعب ولا تبدأ عدّاد الساعة.</p>
    {summary?.exists ? <>
      <p>موعد السهرة: <strong>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "full", timeStyle: "short",
        timeZone: summary.timezone ?? timezone }).format(new Date(summary.scheduledAt!))}</strong></p>
      <p>قالوا جاي: {summary.coming ?? 0} · اعتذروا: {summary.declined ?? 0}</p>
      {link ? <><label htmlFor="night-invite-link">رابط الدعوة — انسخه قبل مغادرة الصفحة</label>
        <input id="night-invite-link" className="form-input" dir="ltr" readOnly value={link} style={{ width: "100%" }} />
        <button className="btn btn-secondary" type="button" onClick={() => {
          void navigator.clipboard.writeText(link).then(() => setNotice("تم نسخ الرابط؛ شاركه مع الأشخاص المقصودين فقط."),
            () => setNotice("حدد الرابط في الحقل وانسخه يدويًا."));
        }}>نسخ رابط الدعوة</button></> :
        <p className="form-note">للدعوة رابط سري سبق إنشاؤه. حفاظًا على خصوصيته لم يُخزَّن نصّه؛ استخدم نسختك المحفوظة. لا تنشئ دعوة ثانية لنفس السهرة.</p>}
    </> : summary && !summary.exists ? <>
      <label htmlFor="night-invite-time">موعد السهرة (بحسب توقيت جهازك)</label>
      <input id="night-invite-time" type="datetime-local" className="form-input"
        value={scheduled} onChange={event => setScheduled(event.target.value)} />
      <p className="form-note">المنطقة الزمنية: {timezone} · الموعد بين 15 دقيقة و90 يومًا من الآن.</p>
      <button className="btn btn-primary" type="button" disabled={busy || !scheduled} onClick={() => void create()}>
        {busy ? "جارٍ الإنشاء…" : "أنشئ رابط الدعوة"}</button>
    </> : <p>جارٍ تحميل الدعوة…</p>}
    {notice && <p role="status" className="form-note">{notice}</p>}
  </section>;
}
