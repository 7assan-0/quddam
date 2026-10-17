"use client";
import { RematchCopy } from "./cta-copy";
import Image from "next/image";
import { useState } from "react";
import type { SocialView } from "@/lib/games/social-deduction/service";
import { useSocialLive } from "./social-live";
export function SocialHost({ initial, joinQr }: { initial: SocialView; joinQr: string }) {
  const { view, error, setError, busy, connection, seconds, send, setView } = useSocialLive(initial, "host");
  const [access, setAccess] = useState<{ url: string; qrDataUrl: string; expiresAt: string } | null>(null);
  const [accessBusy, setAccessBusy] = useState(false); const [copied, setCopied] = useState(false);
  const joinUrl = `/social/join?code=${view.code}`;
  const current = view.participants[view.turnIndex]; const voting = view.phase === "VOTING" || view.phase === "RUNOFF_VOTING";
  async function openDisplay() { setAccessBusy(true); setError("");
    try { const response = await fetch(`/api/social/${view.id}/display-access`, { method: "POST" }); const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر إنشاء رابط العرض"); setAccess(data); setView(current => ({ ...current, displayAccess: { active: true, expiresAt: data.expiresAt } })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر إنشاء رابط العرض"); } finally { setAccessBusy(false); } }
  async function revokeDisplay() { setAccessBusy(true);
    try { const response = await fetch(`/api/social/${view.id}/display-access`, { method: "DELETE" }); if (!response.ok) throw new Error("تعذّر إلغاء الرابط");
      setAccess(null); setView(current => ({ ...current, displayAccess: { active: false, expiresAt: null } })); } catch (cause) { setError(String(cause)); } finally { setAccessBusy(false); } }
  return <main className="shell social-page"><div className="page-title"><span className="eyebrow">إدارة المباراة · خارج الجو</span><h1>الغرفة {view.code}</h1>
    <p>الأدوار والكلمة والأصوات الخاصة لا تظهر للمضيف أثناء اللعب.</p></div>
    {connection && <p className="muted" role="status">{connection}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <div className="host-actions"><button className="btn btn-secondary" disabled={accessBusy} onClick={openDisplay}>فتح شاشة العرض</button>
      {view.displayAccess?.active && <button className="btn btn-outline" disabled={accessBusy} onClick={revokeDisplay}>إلغاء رابط العرض</button>}</div>
    {access && <div className="social-modal-backdrop"><div className="panel social-modal" role="dialog" aria-modal="true" aria-label="رابط شاشة العرض"><button className="btn btn-outline btn-small" onClick={() => setAccess(null)}>إغلاق</button>
      <h2>شاشة العرض</h2><p>امسح الرمز من جهاز التلفاز، دون تسجيل دخول المضيف.</p><Image unoptimized src={access.qrDataUrl} alt="رمز QR لرابط شاشة العرض" width="220" height="220" />
      <p>ينتهي الرابط: {new Date(access.expiresAt).toLocaleString("ar-SA-u-nu-latn")}</p><div className="host-actions">
      <button className="btn btn-primary" onClick={async () => { await navigator.clipboard.writeText(new URL(access.url, window.location.origin).href); setCopied(true); }}>{copied ? "نُسخ الرابط" : "نسخ رابط العرض"}</button>
      <a className="btn btn-secondary" href={access.url} target="_blank" rel="noopener noreferrer">فتح العرض في هذا الجهاز</a><button className="btn btn-outline" onClick={revokeDisplay}>إلغاء رابط العرض</button></div></div></div>}
    {view.phase === "LOBBY" && <section className="panel social-lobby"><div><span className="eyebrow">رمز الانضمام</span><h2 dir="ltr">{view.code}</h2><a href={joinUrl}>رابط انضمام اللاعبين</a></div><Image unoptimized src={joinQr} alt="رمز QR لانضمام اللاعبين" width="200" height="200" />
      <p>انضم {view.participants.length} من 12 · الحد الأدنى 3</p><button className="btn btn-primary" disabled={busy || view.participants.length < 3} onClick={() => send({ type: "START" })}>ابدأ اللعبة</button></section>}
    {view.phase === "ROLE_REVEAL" && <section className="panel social-stage"><h2>وزّعت الأدوار الخاصة</h2><p>دع اللاعبين يطّلعون على جوالاتهم، ثم ابدأ النقاش.</p><button className="btn btn-primary" disabled={busy} onClick={() => send({ type: "BEGIN_DISCUSSION" })}>ابدأ النقاش</button></section>}
    {view.phase === "DISCUSSION" && <section className="panel social-stage"><span className="eyebrow">الدور {view.turnIndex + 1} / {view.participants.length}</span><h2>الدور الآن: {current?.name}</h2>
      <p className="social-timer">{seconds ? `${seconds} ث` : "انتهى الوقت"}</p><div className="host-actions"><button className="btn btn-primary" disabled={busy} onClick={() => send({ type: "ADVANCE_TURN" })}>التالي</button>
      <button className="btn btn-secondary" disabled={busy} onClick={() => send({ type: "BEGIN_VOTING" })}>ابدأ التصويت</button></div></section>}
    {voting && <section className="panel social-stage"><h2>{view.phase === "RUNOFF_VOTING" ? "تصويت الحسم" : "التصويت جارٍ"}</h2><p>{view.voteCount} / {view.participants.length} صوتوا</p>
      {view.phase === "RUNOFF_VOTING" && <p>المرشحون: {view.participants.filter(p => view.candidates.includes(p.id)).map(p => p.name).join("، ")}</p>}
      <button className="btn btn-primary" disabled={busy} onClick={() => send({ type: "CLOSE_VOTING" })}>أغلق التصويت</button></section>}
    {view.phase === "OUTSIDER_GUESS" && <section className="panel social-stage"><h2>انكشف خارج الجو</h2><p>{view.participants.find(p => p.id === view.suspectedId)?.name} يحاول تخمين الكلمة من جواله.</p>
      <p className="social-timer" aria-label="الوقت المتبقي للتخمين">{seconds > 0 ? `${seconds} ث` : "انتهى الوقت"}</p>
      <button className="btn btn-secondary" disabled={busy || seconds > 0} onClick={() => send({ type: "EXPIRE_GUESS" })}>انتهت مهلة التخمين</button>
      <div className="social-tally" aria-label="نتيجة التصويت">{view.tally?.filter(t => t.count > 0).map(t => <span key={t.targetId}>{view.participants.find(p => p.id === t.targetId)?.name}: {t.count}</span>)}</div></section>}
    {(view.phase === "RESULTS" || view.phase === "COMPLETED") && <section className="panel social-stage social-result"><h2>{view.reveal?.winner === "PLAYERS" ? "فاز اللاعبون!" : "فاز خارج الجو!"}</h2>
      <p>خارج الجو: {view.participants.find(p => p.id === view.reveal?.outsiderId)?.name} · الكلمة: {view.reveal?.secretWord}</p>
      <p>المشتبه به: {view.suspectedId ? view.participants.find(p => p.id === view.suspectedId)?.name : "لم يُحسم التصويت"}</p>
      <div className="social-tally" aria-label="نتيجة التصويت">{view.tally?.filter(t => t.count > 0).map(t => <span key={t.targetId}>{view.participants.find(p => p.id === t.targetId)?.name}: {t.count}</span>)}</div>
      {view.phase === "RESULTS" && <button className="btn btn-primary" disabled={busy} onClick={() => send({ type: "COMPLETE" })}>ثبّت النتيجة</button>}
      {view.phase === "COMPLETED" && <button className="btn btn-primary" disabled={busy} onClick={() => send({ type: "REMATCH" })}><RematchCopy previous="إعادة المباراة بنفس اللاعبين"/></button>}</section>}
    {view.phase === "PAUSED" && <section className="panel"><h2>المباراة متوقفة مؤقتًا</h2><p>يبقى الوقت محفوظًا حتى الاستئناف.</p></section>}
    {!["LOBBY", "COMPLETED", "ABANDONED"].includes(view.phase) && <div className="host-actions social-controls">{view.phase === "PAUSED" ? <button className="btn btn-primary" disabled={busy} onClick={() => send({ type: "RESUME" })}>استئناف</button>
      : ["ROLE_REVEAL", "DISCUSSION", "VOTING", "RUNOFF_VOTING", "OUTSIDER_GUESS"].includes(view.phase) && <button className="btn btn-secondary" disabled={busy} onClick={() => send({ type: "PAUSE" })}>إيقاف مؤقت</button>}
      <button className="btn btn-danger" disabled={busy} onClick={() => { if (window.confirm("إنهاء المباراة؟")) send({ type: "END_GAME" }); }}>إنهاء المباراة</button></div>}
    <section className="panel"><h2>اللاعبون بالترتيب</h2><ol className="social-list">{view.participants.map(p => <li className={view.phase === "LOBBY" ? "social-list-manage" : current?.id === p.id && view.phase === "DISCUSSION" ? "social-current" : ""} key={p.id}>
      <span>{p.name}</span>{view.phase === "LOBBY" && <button className="btn btn-outline btn-small" disabled={busy} aria-label={`إزالة ${p.name}`} onClick={() => send({ type: "REMOVE_PARTICIPANT", targetId: p.id })}>إزالة</button>}
    </li>)}</ol></section>
  </main>;
}
