"use client";
import { TeamMarker } from "./team-marker";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { getBoardSession } from "@/lib/games/category-board/service";
import type { BoardCommand, PowerSlug } from "@/lib/games/category-board/module";
import { QuestionReportForm } from "@/components/question-report-form";
import { RoomHostPanel } from "@/components/room-host-panel";
import { AnimatedScore } from "@/components/animated-score";
import { localNowMs, remainingOnClient, serverOffsetMs } from "@/lib/games/category-board/clock";

type View = Awaited<ReturnType<typeof getBoardSession>>;
const format = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-latn").format(value);
const descriptions: Record<PowerSlug, string> = {
  double: "يضاعف نقاط هذا السؤال", shield: "يمنع الفريق الآخر من السرقة", "remove-two": "يخفي إجابتين خاطئتين",
  "extra-time": "يزيد وقت السؤال", challenge: "اطلب إعادة النظر في الإجابة",
};

export function BoardHost({ initial }: { initial: View }) {
  const [view, setView] = useState(initial);
  const viewRef = useRef(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scoreAmount, setScoreAmount] = useState(100);
  const [clock, setClock] = useState(0);
  const [serverOffset, setServerOffset] = useState(() => serverOffsetMs(initial.serverNow, Date.now()));
  const [displayBusy, setDisplayBusy] = useState(false);
  const [displayLink, setDisplayLink] = useState<{ url: string; expiresAt: string; qrDataUrl: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const displayDialog = useRef<HTMLDialogElement>(null);
  const [judgmentFeedback, setJudgmentFeedback] = useState<"correct" | "wrong" | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyView = useCallback((next: View, sentAt: number) => {
    // TV-access refreshes can overlap a judgment. A delayed read must never
    // reopen a completed cell or replace a newer authoritative score.
    if (next.id !== viewRef.current.id || !Number.isSafeInteger(next.version) || next.version < viewRef.current.version) return;
    viewRef.current = next;
    setServerOffset(serverOffsetMs(next.serverNow, localNowMs(), sentAt));
    setView(next);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);
  async function refresh() {
    const sentAt = localNowMs();
    const response = await fetch(`/api/games/category-board/${view.id}`, { cache: "no-store" });
    if (response.ok) { const current: View = await response.json(); applyView(current, sentAt); }
  }
  async function openTv() {
    if (displayBusy) return;
    setDisplayBusy(true); setError("");
    try {
      const response = await fetch(`/api/games/category-board/${view.id}/display-access`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "تعذّر إنشاء رابط العرض");
      setDisplayLink(result);
      setCopyStatus("");
      displayDialog.current?.showModal();
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر إنشاء رابط العرض"); }
    finally { setDisplayBusy(false); }
  }
  async function revokeTv() {
    if (displayBusy) return;
    setDisplayBusy(true); setError("");
    try {
      const response = await fetch(`/api/games/category-board/${view.id}/display-access`, { method: "DELETE" });
      if (!response.ok) throw new Error("تعذّر إلغاء رابط العرض");
      displayDialog.current?.close();
      setDisplayLink(null);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر إلغاء رابط العرض"); }
    finally { setDisplayBusy(false); }
  }
  async function copyDisplayLink() {
    if (!displayLink) return;
    const url = new URL(displayLink.url, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("تم نسخ رابط العرض");
    } catch { setCopyStatus("تعذّر النسخ التلقائي. افتح الرابط من هذا الجهاز أو حاول مجددًا."); }
  }
  function openDisplayHere() {
    if (displayLink) window.open(new URL(displayLink.url, window.location.origin).href, "_blank", "noopener,noreferrer");
  }
  async function send(action: BoardCommand) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const sentAt = localNowMs();
      const response = await fetch(`/api/games/category-board/${view.id}/commands`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: crypto.randomUUID(), expectedVersion: view.version, action }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) await refresh();
        throw new Error(result.error ?? "تعذّر تنفيذ الأمر");
      }
      applyView(result.session, sentAt);
      if (action.type === "CORRECT" || action.type === "WRONG") {
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        setJudgmentFeedback(action.type === "CORRECT" ? "correct" : "wrong");
        feedbackTimer.current = setTimeout(() => setJudgmentFeedback(null), 850);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الاتصال. حدّث الصفحة للتحقق من المباراة."); }
    finally { setBusy(false); }
  }
  const active = view.active;
  const answering = view.teams.find((team) => team.id === active?.answeringTeamId);
  const original = view.teams.find((team) => team.id === active?.originalTeamId);
  const seconds = active ? Math.ceil((clock ? remainingOnClient(active.deadlineAt, active.remainingMs, clock, serverOffset) : active.remainingMs) / 1000) : 0;
  const powers = view.powerUps.filter((power) => (power.teamId === active?.answeringTeamId && (active?.phase !== "STEAL" || power.slug !== "challenge")) ||
    (active?.phase === "STEAL" && power.teamId === active.originalTeamId && power.slug === "challenge"));
  const winnerScore = Math.max(...view.teams.map((team) => team.score));
  const winners = view.teams.filter((team) => team.score === winnerScore);
  const scoreEditor = <div className="score-editor"><label htmlFor="scoreAmount">تعديل النقاط بمقدار</label><input className="input" id="scoreAmount" type="number" min="1" max="10000" value={scoreAmount}
    onChange={(event) => setScoreAmount(Number(event.target.value))} />
    {view.teams.map((team) => <div className="score-edit-team" key={team.id}><strong>{team.name}</strong>
      <button className="btn btn-secondary btn-small" aria-label={`أضف نقاطًا إلى ${team.name}`} disabled={busy || !Number.isInteger(scoreAmount) || scoreAmount < 1 || scoreAmount > 10000}
        onClick={() => send({ type: "EDIT_SCORE", teamId: team.id, delta: scoreAmount })}>+ إضافة</button>
      <button className="btn btn-secondary btn-small" aria-label={`احسم نقاطًا من ${team.name}`} disabled={busy || !Number.isInteger(scoreAmount) || scoreAmount < 1 || scoreAmount > 10000}
        onClick={() => send({ type: "EDIT_SCORE", teamId: team.id, delta: -scoreAmount })}>− حسم</button></div>)}</div>;

  return <div className="shell host-game">
    <dialog ref={displayDialog} className="ui-modal display-link-dialog" aria-labelledby="display-link-title" onClose={() => { setDisplayLink(null); setCopyStatus(""); }}>
      <h2 id="display-link-title">شاشة العرض</h2>
      <p>امسح الرمز من جهاز التلفاز أو انسخ الرابط وافتحه هناك.</p>
      {displayLink && <><Image className="display-link-qr" src={displayLink.qrDataUrl} width={256} height={256} unoptimized alt="رمز QR لرابط شاشة العرض" />
        <p className="muted">تنتهي صلاحية الرابط {new Date(displayLink.expiresAt).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</p>
        <div className="host-actions"><button className="btn btn-primary" onClick={copyDisplayLink}>نسخ رابط العرض</button>
          <button className="btn btn-secondary" onClick={openDisplayHere}>فتح العرض في هذا الجهاز</button>
          <button className="btn btn-outline" disabled={displayBusy} onClick={revokeTv}>إلغاء رابط العرض</button></div>
        {copyStatus && <p role="status">{copyStatus}</p>}</>}
      <button className="btn btn-secondary btn-small" onClick={() => displayDialog.current?.close()}>إغلاق</button>
    </dialog>
    <div className="host-heading"><div><span className="eyebrow">لوحة التحدي · {view.status === "COMPLETED" ? "النتيجة النهائية" : `الجولة ${format(view.round)}`}</span>
      <h1>اقلبوا النتيجة</h1></div><Link className="btn btn-secondary btn-small" href="/games">مكتبة الألعاب</Link></div>
    <div className="scorebar" aria-label="نتائج الفريقين">{view.teams.map((team) => <div className={`team-score ${team.id === view.turnTeamId && view.status !== "COMPLETED" ? "turn" : ""}`} key={team.id} style={{ borderColor: team.color }}>
      <TeamMarker position={team.position} color={team.color} /><div><strong>{team.name}</strong><small>{team.id === view.turnTeamId && view.status !== "COMPLETED" ? "يختار السؤال القادم" : "الفريق"}</small></div><AnimatedScore value={team.score} as="b" />
    </div>)}</div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {judgmentFeedback && <div className={`judgment-feedback judgment-feedback--${judgmentFeedback}`} role="status">{judgmentFeedback === "correct" ? "✓ إجابة صحيحة!" : "✕ إجابة غير صحيحة"}</div>}
    {view.status !== "COMPLETED" && <RoomHostPanel sessionId={view.id} />}

    {view.status === "LOBBY" && <section className="panel host-intro"><span className="eyebrow">كل شيء جاهز</span><h2>{format(view.cells.length)} سؤالًا ينتظرونكم</h2><p>الفريق الأول يختار السؤال. المضيف يكشف الإجابة ويحكم يدويًا، والنتيجة تحفظ تلقائيًا.</p><button className="btn btn-primary" disabled={busy} onClick={() => send({ type: "START" })}>{busy ? "جارٍ البدء..." : "ابدأ المباراة"}</button></section>}

    {view.status === "COMPLETED" && <section className="panel victory"><span className="eyebrow">{view.endedEarly ? "انتهت المباراة مبكرًا" : "انتهت اللوحة"}</span><h2>{winners.length === 1 ? `الفائز: ${winners[0].name}` : "تعادل يستاهل إعادة!"}</h2>
      <p>اللعبة محفوظة في حساب المضيف. مباراة جديدة تعطي الأولوية للأسئلة التي لم تظهر له من قبل.</p>
      <div className="host-actions"><Link className="btn btn-primary" href={`/games/category-board/new?rematch=${view.id}`}>جولة ثانية؟ قدّام!</Link>
        <button className="btn btn-secondary" disabled={displayBusy} onClick={openTv}>فتح شاشة العرض</button>
        {view.displayAccess.active && <button className="btn btn-outline" disabled={displayBusy} onClick={revokeTv}>إلغاء رابط العرض</button>}
        <button className="btn btn-outline" disabled={busy || !view.canUndo} onClick={() => send({ type: "UNDO" })}>تراجع عن آخر تغيير</button></div><details className="score-editor-details"><summary>تعديل النقاط</summary>{scoreEditor}</details></section>}

    {(view.status === "IN_PROGRESS" || view.status === "PAUSED") && <>
      <section className="host-toolbar" aria-label="إدارة المباراة"><div className="host-actions">
        {view.status === "PAUSED" ? <button className="btn btn-primary" disabled={busy} onClick={() => send({ type: "RESUME_GAME" })}>استئناف المباراة</button>
          : <button className="btn btn-secondary" disabled={busy} onClick={() => send({ type: "PAUSE_GAME" })}>إيقاف المباراة مؤقتًا</button>}
        <button className="btn btn-secondary" disabled={displayBusy} onClick={openTv}>فتح شاشة العرض</button>
        {view.displayAccess.active && <button className="btn btn-outline" disabled={displayBusy} onClick={revokeTv}>إلغاء رابط العرض</button>}
        {view.canUndo && <button className="btn btn-outline" disabled={busy} onClick={() => send({ type: "UNDO" })}>تراجع عن آخر إجراء</button>}
        <button className="btn btn-danger" disabled={busy} onClick={() => { if (window.confirm("إنهاء المباراة الآن وإعلان النتيجة الحالية؟")) send({ type: "END_GAME" }); }}>إنهاء المباراة</button>
      </div>{scoreEditor}</section>
      {view.status === "PAUSED" && <p className="paused-note" role="status">المباراة متوقفة. المؤقت محفوظ، واستئناف المباراة يعيد التحكم بالسؤال.</p>}
      {active && <section className="question-stage" aria-live="polite"><div className="question-meta"><span>{view.categories.find((category) => category.id === active.categoryId)?.title} · {format(active.value ?? 0)} نقطة{active.double ? " ×٢" : ""}</span><span>{active.phase === "STEAL" ? "فرصة السرقة" : active.phase === "CHALLENGE" ? "اعتراض على الحكم" : `دور ${answering?.name}`}</span></div>
        <h2>{active.question}</h2>{active.type === "IMAGE" && active.imageUrl && (
          // Admin-controlled question URLs can use different hosts; no image optimization proxy is configured.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="question-image" src={active.imageUrl} alt="صورة السؤال" />)}
        {active.options && <div className="answer-options">{active.options.map((option, index) => <span key={`${index}-${String(option)}`}>{String(option)}</span>)}</div>}
        <fieldset className="game-controls" disabled={busy || view.status === "PAUSED"}><div className="question-timer"><span className={seconds <= 5 ? "urgent" : ""}>الوقت {format(seconds)} ث</span><div className="host-actions">
          <button className="btn btn-secondary btn-small" disabled={busy || Boolean(active.deadlineAt) || seconds === 0} onClick={() => send({ type: "TIMER_START" })}>شغّل المؤقت</button>
          <button className="btn btn-secondary btn-small" disabled={busy || !active.deadlineAt} onClick={() => send({ type: "TIMER_PAUSE" })}>أوقف المؤقت</button>
          <button className="btn btn-secondary btn-small" disabled={busy} onClick={() => send({ type: "TIMER_RESET" })}>إعادة الوقت</button>
        </div></div>
        {active.revealed ? <div className="answer-reveal"><small>الإجابة</small><strong>{active.answer}</strong>{active.explanation && <p>{active.explanation}</p>}</div> : <button className="btn btn-accent btn-game" disabled={busy} onClick={() => send({ type: "REVEAL" })}>اكشف الإجابة</button>}
        {active.phase === "CHALLENGE" ? <div className="host-actions"><span>الفريق {original?.name} اعترض على الحكم. القرار للمضيف.</span><button className="btn btn-primary" disabled={busy} onClick={() => send({ type: "RESOLVE_CHALLENGE", accepted: true })}>قبول الاعتراض</button><button className="btn btn-secondary" disabled={busy} onClick={() => send({ type: "RESOLVE_CHALLENGE", accepted: false })}>رفض الاعتراض</button></div>
          : <div className="host-actions judgment"><button className="btn btn-success btn-game" disabled={busy} onClick={() => send({ type: "CORRECT" })}>صحيح · +{format(active.value! * (active.double && active.answeringTeamId === active.originalTeamId ? 2 : 1))}</button>
            <button className="btn btn-danger btn-game" disabled={busy} onClick={() => send({ type: "WRONG" })}>خطأ{active.phase === "QUESTION" && !active.shield ? " · فرصة سرقة" : ""}</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => send({ type: "SKIP" })}>تخطي</button></div>}
        <div className="power-list" aria-label="قدرات الفريق">{powers.map((power) => {
          const slug = power.slug as PowerSlug;
          const allowed = power.remaining > 0 && (slug === "challenge" ? active.phase === "STEAL" : slug === "extra-time" ? active.phase !== "CHALLENGE" :
            active.phase === "QUESTION" && !active.revealed && (slug !== "remove-two" || active.type === "MULTIPLE_CHOICE"));
          return <button className="power-button" key={`${power.teamId}-${slug}`} disabled={busy || !allowed} title={!allowed ? "لا يمكن استخدام هذه القدرة في هذه اللحظة" : descriptions[slug]}
            onClick={() => send({ type: "USE_POWERUP", slug })}><strong>{power.title}</strong><small>{view.teams.find((team) => team.id === power.teamId)?.name} · {descriptions[slug]} · متبقي {format(power.remaining)}</small></button>;
        })}</div></fieldset><QuestionReportForm key={active.questionId} sessionId={view.id} questionId={active.questionId} />
      </section>}

      {!active && view.canUndo && <div className="host-actions after-round"><span>حُفظت الجولة. اختروا السؤال التالي.</span></div>}
      <section className="board-section"><div className="section-head"><div><span className="eyebrow">اللوحة</span><h2>{active ? "السؤال المفتوح" : "اختاروا السؤال التالي"}</h2></div><p>القيم الأعلى أصعب، والخانة المستخدمة تختفي من اللعب.</p></div>
        <div className="board-grid">{view.categories.map(category => <div className="board-column" key={category.id}><h3>{category.title}</h3>
          {view.cells.filter(cell => cell.categoryId === category.id).map(cell => {
            const numberInLevel = view.cells.filter(item => item.categoryId === category.id && item.value === cell.value)
              .findIndex(item => item.key === cell.key) + 1;
            const label = numberInLevel > 1 ? `سؤال ${numberInLevel} · ${category.title} · ${cell.value} نقطة` : `${category.title} ${cell.value}`;
            return <button key={cell.key} className={`board-cell ${cell.completed ? "used" : ""}`}
              disabled={busy || view.status === "PAUSED" || Boolean(active) || cell.completed}
              aria-label={`${label}${cell.completed ? " مستخدم" : ""}`}
              onClick={() => send({ type: "OPEN", cellKey: cell.key })}>{cell.completed ? "✓" : format(cell.value)}</button>;
          })}</div>)}</div></section>
    </>}
  </div>;
}
