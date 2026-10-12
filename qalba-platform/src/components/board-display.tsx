"use client";
import { TeamMarker } from "./team-marker";
import { connectLive, liveRetryDelay } from "@/lib/realtime/client";
import { terminalAccessStatus } from "@/lib/realtime/access-status";
import { Brand } from "./brand";
import { useEffect, useRef, useState } from "react";
import type { getBoardSession } from "@/lib/games/category-board/service";
import { AnimatedScore } from "@/components/animated-score";
import { remainingOnClient, serverOffsetMs } from "@/lib/games/category-board/clock";
import { DISPLAY_COMPLETED_GRACE_MS, displayWatchFinished } from "@/lib/games/category-board/display-policy";

type View = Awaited<ReturnType<typeof getBoardSession>>;
const number = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-latn").format(value);

export function BoardDisplay({ initial, displayToken }: { initial: View; displayToken?: string }) {
  const [view, setView] = useState(initial);
  const viewRef = useRef(initial);
  const [clock, setClock] = useState(0);
  const [serverOffset, setServerOffset] = useState(() => serverOffsetMs(initial.serverNow, Date.now()));
  const offsetRef = useRef(serverOffset);
  const [connection, setConnection] = useState("");
  const [feedback, setFeedback] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
    let stream: ReturnType<typeof connectLive<View>> | undefined;
    let ended = false, attempt = 0; const abort = new AbortController();
    let version = initial.version;
    let settled = displayWatchFinished(initial);
    const url = displayToken ? `/api/display/${initial.id}?token=${encodeURIComponent(displayToken)}` : `/api/games/category-board/${initial.id}`;
    const apply = (current: View, sentAt: number) => {
      if (!alive || ended || current.version < version) return;
      offsetRef.current = serverOffsetMs(current.serverNow, Date.now(), sentAt);
      setServerOffset(offsetRef.current);
      if (current.version > version) {
        version = current.version;
        const previous = viewRef.current;
        viewRef.current = current;
        const increased = current.teams.find((team) => team.score > (previous.teams.find((prior) => prior.id === team.id)?.score ?? team.score));
        const message = current.lastCommandType === "CORRECT" && increased
          ? `إجابة صحيحة · +${number(increased.score - (previous.teams.find((team) => team.id === increased.id)?.score ?? 0))}`
          : current.lastCommandType === "WRONG" && current.active?.phase === "STEAL" ? "إجابة خاطئة · فرصة سرقة"
          : current.lastCommandType === "WRONG" ? "إجابة خاطئة"
          : current.lastCommandType === "EDIT_SCORE" ? "تعديل النقاط" : "";
        if (message) { setFeedback(message); if (feedbackTimer) clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => setFeedback(""), 1300); }
        setView(current);
      }
      setConnection("");
      if (current.lastCommandType === "UNDO") { setFeedback(""); if (feedbackTimer) clearTimeout(feedbackTimer); }
      if (displayWatchFinished(current)) { settled = true; stream?.close(); if (timer) clearTimeout(timer); }
    };
    const terminal = () => { ended = true; stream?.close(); clearTimeout(timer); abort.abort(); setConnection("انتهت صلاحية الوصول إلى المباراة أو العرض."); setView(current => ({ ...current, active: null })); };
    const fetchLatest = async () => {
      try {
        const sentAt = Date.now(), response = await fetch(url, { cache: "no-store", signal: abort.signal });
        if (!alive || ended) return;
        if (!response.ok) { if (terminalAccessStatus(response.status)) { terminal(); return; } throw new Error("جارٍ إعادة الاتصال بشاشة العرض…"); }
        const current: View = await response.json(); if (!alive || ended) return; attempt = 0; apply(current, sentAt);
      } catch { if (alive && !ended) { attempt++; setConnection("جارٍ إعادة الاتصال بشاشة العرض…"); } }
      finally {
        // Host-authenticated preview has no bearer expiry; bound its final-state watch too.
        const finalWindow = !viewRef.current.endedAt || Date.parse(String(viewRef.current.endedAt)) + DISPLAY_COMPLETED_GRACE_MS > Date.now() + offsetRef.current;
        if (alive && !ended && !settled && finalWindow) timer = setTimeout(fetchLatest, attempt ? liveRetryDelay(attempt - 1) : 1500);
      }
    };
    if (!settled && displayToken) {
      stream = connectLive<View>({ events: `/api/display/${initial.id}/events?token=${encodeURIComponent(displayToken)}`, endpoint: url,
        apply, terminal, temporary: () => setConnection("جارٍ إعادة الاتصال بشاشة العرض…"),
      });
    } else if (!settled) timer = setTimeout(fetchLatest, 1500);
    return () => { alive = false; abort.abort(); stream?.close(); if (timer) clearTimeout(timer); if (feedbackTimer) clearTimeout(feedbackTimer); };
  }, [initial, displayToken]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => { window.clearInterval(timer); document.removeEventListener("fullscreenchange", onChange); };
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setConnection("المتصفح منع ملء الشاشة. جرّب زر العرض في المتصفح."); }
  }
  const active = view.active;
  const team = view.teams.find((item) => item.id === active?.answeringTeamId);
  const activeTeamId = active?.answeringTeamId ?? view.turnTeamId;
  const winners = view.teams.filter((item) => item.score === Math.max(...view.teams.map((entry) => entry.score)));
  const seconds = active ? Math.ceil((clock ? remainingOnClient(active.deadlineAt, active.remainingMs, clock, serverOffset) : active.remainingMs) / 1000) : 0;
  return <div className="display-mode" aria-label="شاشة عرض لوحة التحدي">
    <div className="display-top"><div><span className="display-brand"><Brand/></span><span className="display-caption">لوحة التحدي · الجولة {number(view.round)}</span></div>
      <div className="display-status">{view.status === "PAUSED" ? "المباراة متوقفة" : view.status === "COMPLETED" ? "النتيجة النهائية" : view.status === "LOBBY" ? "في انتظار البداية" : "المباراة مستمرة"}</div>
      <button className="display-fullscreen" onClick={toggleFullscreen}>{fullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}</button></div>
    {connection && <p className="display-connection" role="status">{connection}</p>}
    {feedback && <p className="display-connection" role="status">{feedback}</p>}
    <div className="display-scores">{view.teams.map((item) => <div key={item.id} className={`display-team ${item.id === activeTeamId && view.status !== "COMPLETED" ? "display-team--active" : ""}`} style={{ borderColor: item.color }}><div><span><TeamMarker position={item.position} color={item.color} />{item.name}</span>{item.id === activeTeamId && view.status !== "COMPLETED" && <small className="display-team-status">الدور الآن</small>}</div><AnimatedScore value={item.score} /></div>)}</div>
    {view.status === "COMPLETED" ? <section className="display-center display-victory"><span>انتهت المباراة</span><h1>{winners.length === 1 ? `الفائز: ${winners[0].name}` : "تعادل!"}</h1><p>{view.endedEarly ? "النتيجة عند إنهاء المضيف للمباراة" : "اكتملت أسئلة اللوحة"}</p></section>
      : active ? <section className={`display-center display-question ${active.phase === "STEAL" ? "display-feedback-wrong" : ""}`}><div className="display-question-top"><span>{view.categories.find((category) => category.id === active.categoryId)?.title} · {number(active.value ?? 0)} نقطة{active.double ? " ×٢" : ""}</span><span>{active.phase === "STEAL" ? `إجابة غير صحيحة · فرصة السرقة · ${team?.name}` : active.phase === "CHALLENGE" ? "اعتراض على الحكم" : `دور ${team?.name}`}</span></div>
          <h1>{active.question}</h1>{active.type === "IMAGE" && active.imageUrl && (
            // Question media uses admin-controlled URLs from varied hosts.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="display-image" src={active.imageUrl} alt="صورة السؤال" />)}
          {active.options && <div className="display-options">{active.options.map((option, index) => <span key={`${index}-${String(option)}`}>{String(option)}</span>)}</div>}
          {active.revealed && <div className="display-answer">الإجابة: <strong>{active.answer}</strong></div>}
          <div className={`display-timer ${seconds <= 5 ? "urgent" : ""}`}>{active.deadlineAt && seconds === 0 ? "انتهى الوقت" : `الوقت ${number(seconds)} ث`}</div>
        </section>
        : <section className="display-center display-wait"><span>{view.status === "PAUSED" ? "ننتظر المضيف" : view.status === "LOBBY" ? "استعدوا للعب" : `الدور على ${view.teams.find((item) => item.id === view.turnTeamId)?.name}`}</span><h1>{view.status === "LOBBY" ? "جهزوا فرقكم" : "اختاروا السؤال التالي"}</h1></section>}
    <div className="display-grid" aria-label="لوحة الأسئلة">{view.categories.map((category) => <div className="display-column" key={category.id}><h2>{category.title}</h2>{[200, 400, 600].map((value) => {
      const cell = view.cells.find((item) => item.categoryId === category.id && item.value === value);
      return <div className={`display-cell ${cell?.completed ? "done" : ""}`} key={value}>{cell?.completed ? "✓" : number(value)}</div>;
    })}</div>)}</div>
  </div>;
}
