"use client";
import { TeamMarker } from "./team-marker";
import { connectLive } from "@/lib/realtime/client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { roomView } from "@/lib/rooms/service";
import { remainingOnClient, serverOffsetMs } from "@/lib/games/category-board/clock";
import { acceptsRoomView } from "./room-view-order";

type View = Awaited<ReturnType<typeof roomView>>;
export function RoomLive({ initial, joinQr }: { initial: View; joinQr?: string }) {
  const [view, setView] = useState(initial); const [answer, setAnswer] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [connected, setConnected] = useState(true);
  const [clock, setClock] = useState(0);
  const [offset, setOffset] = useState(() => serverOffsetMs(initial.serverNow, Date.now()));
  const roundRef = useRef(initial.session.round);
  const viewRef = useRef(initial);
  const terminalRef = useRef(false);
  const applyView = useCallback((next: View, sentAt?: number) => {
    if (terminalRef.current || !acceptsRoomView(viewRef.current, next)) return;
    viewRef.current = next;
    if (roundRef.current !== next.session.round) {
      roundRef.current = next.session.round; setAnswer("");
    }
    setOffset(serverOffsetMs(next.serverNow, Date.now(), sentAt));
    setView(next);
  }, []);
  useEffect(() => {
    const live = connectLive<View>({ events: `/api/rooms/${initial.code}/events`, endpoint: `/api/rooms/${initial.code}`,
      apply: (next, sentAt) => { applyView(next, sentAt); setConnected(true); },
      temporary: () => setConnected(false),
      terminal: () => { terminalRef.current = true; setConnected(false); setAnswer(""); setView(current => ({ ...current, responses: undefined, session: { ...current.session, active: null } })); },
    });
    return () => live.close();
  }, [initial.code, applyView]);
  useEffect(() => {
    const tick = () => setClock(Date.now()), timer = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);
  const active = view.session.active; const self = view.participants.find((person) => person.id === view.selfId);
  const remaining = active ? remainingOnClient(active.deadlineAt, active.remainingMs, clock || Date.parse(view.serverNow) - offset, offset) : 0;
  const responseOpen = active && view.session.status === "IN_PROGRESS" && active.phase !== "CHALLENGE" && !active.revealed && remaining > 0;
  async function send(path: string, data: object) {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/rooms/${view.code}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "تعذّر إرسال الطلب"); applyView(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الاتصال"); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send("responses", { response: answer, vote: false }); }
  return <main className="shell room-page"><div className="room-heading"><div><span className="eyebrow">غرفة لوحة التحدي</span><h1 dir="ltr">{view.code}</h1></div><span role="status" className="badge">{connected ? "مباشر" : "يعاد الاتصال..."}</span></div>
    {view.host && <p><Link className="btn btn-secondary" href={`/play/${view.session.id}`}>ارجع إلى تحكم المضيف</Link></p>}
    {view.host && view.session.status === "LOBBY" && joinQr && <section className="panel room-qr"><Image unoptimized src={joinQr} width={240} height={240} alt="رمز QR لانضمام اللاعبين"/><div><h2>خلّوا الجماعة تنضم</h2><p>امسحوا الرمز من الجوال أو شاركوا رمز الغرفة. كل لاعب يختار فريقه ويجهّز نفسه.</p><Link className="btn btn-secondary" href={`/join?code=${view.code}`}>رابط الانضمام</Link></div></section>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <section className="scorebar">{view.session.teams.map((team, index) => <div className="team-score" key={team.id} style={{ borderColor: team.color }}><strong><TeamMarker position={index} color={team.color} />{team.name}</strong><b>{team.score}</b></div>)}</section>
    <section className="panel"><h2>اللاعبون · {view.participants.length}</h2><div className="room-roster">{view.participants.map((person) => <div key={person.id} className="room-person"><strong>{person.name}{person.id === view.selfId ? " · أنت" : ""}</strong><span>{view.session.teams.find((team) => team.id === person.teamId)?.name} · {person.ready ? "جاهز" : "ينتظر"}</span></div>)}</div>
      {!view.host && view.session.status === "LOBBY" && <button className="btn btn-primary" disabled={busy} onClick={() => send("ready", { ready: !self?.ready })}>{self?.ready ? "إلغاء الجاهزية" : "أنا جاهز"}</button>}
      {view.session.status === "LOBBY" && <p>المضيف يبدأ المباراة من لوحة التحكم.</p>}</section>
    {active && <section className="panel room-question"><span className="eyebrow">السؤال {view.session.round}</span><h2>{active.question}</h2><output className="timer" aria-label="الوقت المتبقي" data-ms={Math.round(remaining)}>{Math.ceil(remaining / 1000)}<small> ثانية{view.session.status === "PAUSED" ? " · متوقفة" : remaining === 0 ? " · انتهى الوقت" : ""}</small></output>{active.imageUrl && (
      // Admin-controlled question URLs use external hosts; no image optimization proxy is configured.
      // eslint-disable-next-line @next/next/no-img-element
      <img className="question-image" src={active.imageUrl} alt="صورة السؤال" />)}
      {active.options && <div className="answer-options">{active.options.map((option) => <span key={option}>{option}</span>)}</div>}
      {active.revealed ? <div className="answer-reveal"><small>الإجابة</small><strong>{active.answer}</strong></div> : !view.host && view.session.status === "IN_PROGRESS" && <>
        <form onSubmit={submit}><label htmlFor="room-answer">إجابتك للمضيف</label><div className="room-answer"><input className="input" id="room-answer" maxLength={300} required value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={busy || view.submitted || !responseOpen} /><button className="btn btn-primary" disabled={busy || view.submitted || !responseOpen}>{view.submitted ? "وصلت إجابتك" : "أرسل"}</button></div></form>
        {active.options && !view.voted && <div className="host-actions"><span>صوّت لإجابة ظاهرة:</span>{active.options.map((option) => <button key={option} className="btn btn-secondary btn-small" disabled={busy || !responseOpen} onClick={() => send("responses", { response: option, vote: true })}>{option}</button>)}</div>}
        {view.voted && <p>تم تسجيل صوتك.</p>}
      </>}{view.host && <p>وصلت {view.voteCount} أصوات. الحكم والنقاط من لوحة المضيف.</p>}</section>}
    {view.host && view.responses && view.responses.length > 0 && <section className="panel"><h2>إجابات اللاعبين</h2>{view.responses.map((item, index) => <p key={index}><strong>{item.name}</strong> · {String((item.response as { text?: string }).text ?? "")}</p>)}</section>}
    {view.session.status === "COMPLETED" && <section className="panel victory"><h2>انتهت المباراة</h2><p>النتيجة محفوظة عند المضيف.</p></section>}
  </main>;
}
