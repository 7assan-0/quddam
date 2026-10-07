"use client";
import { useEffect, useState } from "react";
import type { SocialView } from "@/lib/games/social-deduction/service";
import { useSocialLive } from "./social-live";
export function SocialPlayer({ initial }: { initial: SocialView }) {
  const { view, error, busy, connection, seconds, send } = useSocialLive(initial, "player");
  const ballotKey = `${view.roundId}:${view.ballot}`;
  const [selection, setSelection] = useState({ boundary: ballotKey, target: "" });
  const target = selection.boundary === ballotKey ? selection.target : "";
  const setTarget = (target: string) => setSelection({ boundary: ballotKey, target });
  const [guess, setGuess] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  useEffect(() => { if (!revealedKey) return; const timer = window.setTimeout(() => setRevealedKey(null), 5000); return () => clearTimeout(timer); }, [revealedKey]);
  const self = view.self!; const current = view.participants[view.turnIndex];
  const voting = view.phase === "VOTING" || view.phase === "RUNOFF_VOTING";
  const roleKey = `${view.round}:${view.phase}`;
  const roleVisible = view.phase === "ROLE_REVEAL" || revealedKey === roleKey;
  return <main className="shell social-page social-player" data-phase={view.phase}><div className="page-title"><span className="eyebrow">خارج الجو · الجولة {view.round || 1}</span><h1>حيّاك يا {view.participants.find(p => p.id === self.id)?.name}</h1><p>رمز الغرفة: <strong dir="ltr">{view.code}</strong></p></div>
    {connection && <p className="muted" role="status">{connection}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {view.phase === "LOBBY" && <section className="panel"><h2>انتظروا بقية اللاعبين</h2><p>{view.participants.length} / ١٢ انضموا · تبدأ اللعبة عند قرار المضيف.</p></section>}
    {view.phase !== "LOBBY" && <section className="panel social-role" aria-label="دورك الخاص"><span className="eyebrow">بطاقتك الخاصة</span>
      {roleVisible ? <><h2>{self.role === "OUTSIDER" ? "أنت خارج الجو" : "أنت تعرف الكلمة"}</h2>
        <p>{self.role === "OUTSIDER" ? "راقب الحديث وحاول تخمين الكلمة دون أن ينكشف أمرك." : "ناقشوا الموضوع دون نطق الكلمة مباشرة."}</p>
        {self.secretWord && <strong className="social-secret">{self.secretWord}</strong>}</>
        : <><h2>بطاقتك مخفية</h2><p>اعرضها بعيدًا عن أنظار اللاعبين الآخرين.</p></>}
      {view.phase !== "ROLE_REVEAL" && <button className="btn btn-outline" onClick={() => setRevealedKey(roleVisible ? null : roleKey)}>
        {roleVisible ? "إخفاء بطاقتي" : "إظهار بطاقتي"}</button>}</section>}
    {view.phase === "ROLE_REVEAL" && <section className="panel"><h2>اطّلع على بطاقتك</h2><p>انتظر المضيف لبدء النقاش.</p></section>}
    {view.phase === "PAUSED" && <p className="panel" role="status">المباراة متوقفة مؤقتًا.</p>}
    {view.phase === "DISCUSSION" && <section className="panel social-stage"><span className="eyebrow">النقاش · {view.turnIndex + 1} / {view.participants.length}</span>
      <h2>الدور على {current?.name}</h2><p className="social-timer" aria-live="off">{seconds > 0 ? `${seconds} ث` : "انتهى الوقت"}</p>
      <p>اسأل أو جاوب بصوتك. لا يلزم كتابة السؤال.</p>
      {self.id === current?.id && <button className="btn btn-primary" disabled={busy || seconds === 0} onClick={() => send({ type: "FINISH_TURN" })}>انتهيت</button>}</section>}
    {voting && <section className="panel social-stage"><span className="eyebrow">{view.phase === "RUNOFF_VOTING" ? `جولة حسم ${view.ballot - 1}` : "التصويت"}</span><h2>مين خارج الجو؟</h2>
      <p>صوّت من جوالك. لا تظهر اختيارات اللاعبين قبل إغلاق التصويت.</p>
      <div className="social-options" role="radiogroup" aria-label="اختر لاعبًا">{view.participants.filter(p => p.id !== self.id && view.candidates.includes(p.id)).map(p => <label key={p.id} className="social-option"><input type="radio" name="suspect" checked={target === p.id || (!target && self.votedFor === p.id)} onChange={() => setTarget(p.id)} />{p.name}</label>)}</div>
      <button className="btn btn-primary" disabled={busy || !(target || self.votedFor)} onClick={async () => { if (await send({ type: "SUBMIT_VOTE", roundId: view.roundId!, ballot: view.ballot, targetId: target || self.votedFor! })) setTarget(""); }}>{self.votedFor ? "غيّر صوتك" : "أرسل صوتك"}</button>
      {self.votedFor && <p role="status">تم تسجيل صوتك. يمكنك تغييره قبل إغلاق التصويت.</p>}</section>}
    {view.phase === "OUTSIDER_GUESS" && <section className="panel social-stage"><h2>انكشف خارج الجو!</h2><p>الاختيار: {view.participants.find(p => p.id === view.suspectedId)?.name}. له فرصة أخيرة لتخمين الكلمة.</p>
      <p className="social-timer" aria-label="الوقت المتبقي للتخمين">{seconds > 0 ? `${seconds} ث` : "انتهى الوقت"}</p>
      {self.role === "OUTSIDER" && <form onSubmit={e => { e.preventDefault(); send({ type: "SUBMIT_GUESS", guess }); }}><label>ما الكلمة السرية؟<input value={guess} maxLength={100} onChange={e => setGuess(e.target.value)} required /></label><button className="btn btn-primary" disabled={busy || seconds === 0}>أرسل التخمين</button></form>}</section>}
    {(view.phase === "RESULTS" || view.phase === "COMPLETED") && <section className="panel social-stage social-result"><span className="eyebrow">النتيجة النهائية</span>
      <h2>{view.reveal?.winner === "PLAYERS" ? "فاز اللاعبون!" : "فاز خارج الجو!"}</h2>
      <p>خارج الجو: {view.participants.find(p => p.id === view.reveal?.outsiderId)?.name}</p><p>الكلمة: <strong>{view.reveal?.secretWord}</strong></p>
      {view.reveal?.guess && <p>التخمين: {view.reveal.guess}</p>}{view.phase === "COMPLETED" && <p>انتظر إعادة المباراة من المضيف.</p>}</section>}
    {view.phase === "ABANDONED" && <section className="panel"><h2>انتهت المباراة</h2></section>}
    <section className="panel"><h2>ترتيب الأدوار</h2><ol className="social-list">{view.participants.map(p => <li key={p.id} className={p.id === current?.id && view.phase === "DISCUSSION" ? "social-current" : ""}>{p.name}{p.id === self.id ? " · أنت" : ""}</li>)}</ol></section>
  </main>;
}
