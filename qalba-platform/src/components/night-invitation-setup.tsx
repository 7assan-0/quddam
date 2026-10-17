"use client";

import { useEffect, useRef, useState } from "react";
import { invitationLocalInstant } from "@/lib/night/invitation-time";

type Summary = { exists: boolean; status?: string; scheduledAt?: string; timezone?: string;
  coming?: number; declined?: number; votes?: { game: string; title: string; count: number }[] };
export function NightInvitationSetup({ nightId }: { nightId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scheduled, setScheduled] = useState("");
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Riyadh");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void fetch(`/api/night/${nightId}/invitation`, { credentials: "same-origin", cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (active) setSummary(data.invitation); })
      .catch(() => { if (active) setNotice("تعذر قراءة حالة الدعوة؛ حاول تحديث الصفحة."); });
    return () => { active = false; };
  }, [nightId]);
  async function create() {
    if (!scheduled || busy) return;
    const scheduledAt = invitationLocalInstant(scheduled, timezone);
    if (!scheduledAt) { setNotice("تحقق من الموعد. اختر وقتًا صالحًا وغير متكرر عند تغيّر التوقيت الصيفي."); return; }
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/night/${nightId}/invitation`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, timezone }),
      });
      const data = await response.json();
      if (!response.ok) { setNotice(data.error ?? "تعذر إنشاء الدعوة."); return; }
      // Intentionally only held in this browser tab; the database stores its hash.
      setLink(new URL(data.invitation.path, location.origin).href);
      setSummary({ exists: true, status: "open", scheduledAt: data.invitation.scheduledAt,
        timezone: data.invitation.timezone, coming: 0, declined: 0,
        votes: [{ game: "top-list", title: "توب 100", count: 0 }, { game: "ordering-challenge", title: "رتّبها", count: 0 }, { game: "survey-show", title: "قالوا الناس", count: 0 }] });
      setNotice("تم إنشاء رابط الدعوة. انسخه الآن واحتفظ به؛ لا يمكن استرجاع نص الرابط من قاعدة البيانات.");
    } catch { setNotice("تعذر إنشاء الدعوة. لا تعاود الطلب قبل تحديث حالة الدعوة."); }
    finally { setBusy(false); }
  }
  async function revoke() {
    if (busy || summary?.status !== "open" ||
      !window.confirm("إلغاء رابط دعوة السهرة نهائيًا؟ لن يستطيع أحد فتحه أو الرد عليه، ولن يُنشأ رابط بديل تلقائيًا.")) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/night/${nightId}/invitation`, {
        method: "DELETE", credentials: "same-origin", cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر إلغاء الدعوة.");
      setLink("");
      setSummary(old => old?.exists ? { ...old, status: "revoked" } : old);
      setNotice("أُلغي رابط الدعوة. بقيت إحصاءات الردود القديمة محفوظة، ولا يقبل الرابط ردودًا جديدة.");
    } catch { setNotice("تعذّر تأكيد الإلغاء. حدّث الحالة قبل إعادة المحاولة."); }
    finally { setBusy(false); }
  }
  async function refresh() {
    // Serialize manual snapshots: an older slow response must not overwrite a
    // newer attendance/vote result from another simultaneous refresh.
    if (refreshInFlight.current) return;
    refreshInFlight.current = true; setRefreshing(true);
    try {
      const response = await fetch(`/api/night/${nightId}/invitation`, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setSummary(data.invitation); setNotice("تم تحديث الحضور والتصويت.");
    } catch { setNotice("تعذر تحديث الدعوة حاليًا."); }
    finally { refreshInFlight.current = false; setRefreshing(false); }
  }
  return <section className="panel" data-testid="night-invitation-setup" style={{ marginBlock: "1rem" }}>
    <h2>دعوة السهرة · قبل بدء اللعب</h2>
    <p>حدد الموعد وشارك رابط الحضور يدويًا. هذه دعوة تخطيط وتصويت فقط؛ لا تفتح غرفة اللعب ولا تبدأ عدّاد الساعة. التصويت استشاري ولا يعيد ترتيب ألعاب السهرة المحفوظة تلقائيًا.</p>
    {summary?.exists ? <>
      <p>موعد السهرة: <strong>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "full", timeStyle: "short",
        timeZone: summary.timezone ?? timezone }).format(new Date(summary.scheduledAt!))}</strong></p>
      <p>قالوا جاي: {summary.coming ?? 0} · اعتذروا: {summary.declined ?? 0}</p>
      <h3>نتائج التصويت</h3>
      <ul>{summary.votes?.map(v => <li key={v.game}>{v.title}: {v.count} صوت</li>)}</ul>
      <button className="btn btn-outline" type="button" disabled={refreshing} aria-busy={refreshing}
        onClick={() => void refresh()}>تحديث الحضور والتصويت</button>
      {summary.status === "revoked" && <p role="status" className="form-note">الدعوة ملغاة؛ الرابط القديم غير صالح. نتائج الحضور السابقة للعرض فقط.</p>}
      {summary.status === "open" && <button className="btn btn-danger" type="button"
        disabled={busy} onClick={() => void revoke()}>إلغاء رابط الدعوة نهائيًا</button>}
      {summary.status === "open" && (link ? <><label htmlFor="night-invite-link">رابط الدعوة — انسخه قبل مغادرة الصفحة</label>
        <input id="night-invite-link" className="form-input" dir="ltr" readOnly value={link} style={{ width: "100%" }} />
        <button className="btn btn-secondary" type="button" onClick={() => {
          void navigator.clipboard.writeText(link).then(() => setNotice("تم نسخ الرابط؛ شاركه مع الأشخاص المقصودين فقط."),
            () => setNotice("حدد الرابط في الحقل وانسخه يدويًا."));
        }}>نسخ رابط الدعوة</button></> :
        <p className="form-note">للدعوة رابط سري سبق إنشاؤه. حفاظًا على خصوصيته لم يُخزَّن نصّه؛ استخدم نسختك المحفوظة. لا تنشئ دعوة ثانية لنفس السهرة.</p>)}
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
