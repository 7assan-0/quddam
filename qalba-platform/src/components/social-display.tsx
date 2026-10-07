"use client";
import { Brand } from "./brand";
import Image from "next/image";
import type { SocialView } from "@/lib/games/social-deduction/service";
import { useSocialLive } from "./social-live";
export function SocialDisplay({ initial, token, joinQr }: { initial: SocialView; token: string; joinQr: string }) {
  const { view, connection, seconds } = useSocialLive(initial, "display", token);
  const current = view.participants[view.turnIndex]; const voting = view.phase === "VOTING" || view.phase === "RUNOFF_VOTING";
  return <div className="display-mode social-tv" aria-label="شاشة عرض خارج الجو"><div className="display-top"><div><span className="display-brand"><Brand/></span><span className="display-caption">خارج الجو · الجولة {view.round || 1}</span></div>
    <span className="display-status">{view.phase === "PAUSED" ? "المباراة متوقفة" : view.phase === "COMPLETED" ? "النتيجة النهائية" : "جمعتنا مستمرة"}</span></div>
    {connection && <p role="status" className="display-connection">{connection}</p>}
    {view.phase === "LOBBY" && <section className="display-center social-tv-stage"><span>امسح الرمز وانضم من جوالك</span><h1 dir="ltr">{view.code}</h1><Image unoptimized src={joinQr} alt="رمز انضمام اللاعبين" width="230" height="230" />
      <p>{view.participants.length} لاعب انضموا</p></section>}
    {view.phase === "ROLE_REVEAL" && <section className="display-center social-tv-stage"><span>الأدوار وصلت إلى الجوالات</span><h1>اطّلعوا على بطاقاتكم</h1></section>}
    {view.phase === "DISCUSSION" && <section className="display-center social-tv-stage"><span>الدور {view.turnIndex + 1} من {view.participants.length}</span><h1>الدور الآن: {current?.name}</h1><div className="display-timer">{seconds ? `${seconds} ث` : "انتهى الوقت"}</div></section>}
    {voting && <section className="display-center social-tv-stage"><span>{view.phase === "RUNOFF_VOTING" ? "جولة حسم" : "القرار عندكم"}</span><h1>التصويت جارٍ</h1><p>{view.voteCount} / {view.participants.length} صوتوا</p>
      {view.phase === "RUNOFF_VOTING" && <><p>بين {view.participants.filter(p => view.candidates.includes(p.id)).map(p => p.name).join(" و ")}</p>
        <div className="social-tally" aria-label="نتيجة الجولة السابقة">{view.tally?.filter(t => t.count > 0).map(t => <span key={t.targetId}>{view.participants.find(p => p.id === t.targetId)?.name}: {t.count}</span>)}</div></>}</section>}
    {view.phase === "OUTSIDER_GUESS" && <section className="display-center social-tv-stage"><span>اكتمل التصويت</span><h1>انكشف خارج الجو!</h1><p>{view.participants.find(p => p.id === view.suspectedId)?.name} لديه فرصة لتخمين الكلمة</p>
      <div className="display-timer" aria-label="الوقت المتبقي للتخمين">{seconds > 0 ? `${seconds} ث` : "انتهى الوقت"}</div>
      <div className="social-tally" aria-label="نتيجة التصويت">{view.tally?.filter(t => t.count > 0).map(t => <span key={t.targetId}>{view.participants.find(p => p.id === t.targetId)?.name}: {t.count}</span>)}</div></section>}
    {(view.phase === "RESULTS" || view.phase === "COMPLETED") && <section className="display-center display-victory social-tv-stage"><span>انكشفت الحقيقة</span><h1>{view.reveal?.winner === "PLAYERS" ? "فاز اللاعبون!" : "فاز خارج الجو!"}</h1>
      <p>المشتبه به: {view.suspectedId ? view.participants.find(p => p.id === view.suspectedId)?.name : "لم يُحسم التصويت"}</p>
      <div className="social-tally" aria-label="نتيجة التصويت">{view.tally?.filter(t => t.count > 0).map(t => <span key={t.targetId}>{view.participants.find(p => p.id === t.targetId)?.name}: {t.count}</span>)}</div>
      <p>خارج الجو: {view.participants.find(p => p.id === view.reveal?.outsiderId)?.name}</p><p>الكلمة السرية: <strong>{view.reveal?.secretWord}</strong></p></section>}
    {view.phase === "PAUSED" && <section className="display-center social-tv-stage"><h1>توقف مؤقت</h1></section>}
    {view.phase === "ABANDONED" && <section className="display-center social-tv-stage"><h1>انتهت المباراة</h1></section>}
    <div className="display-scores social-tv-players">{view.participants.map(p => <div key={p.id} className={`display-team ${view.phase === "DISCUSSION" && p.id === current?.id ? "display-team--active" : ""}`}>
      <div><span>{p.name}</span>{view.phase === "DISCUSSION" && p.id === current?.id && <small className="display-team-status">الدور الآن</small>}</div></div>)}</div>
  </div>;
}
