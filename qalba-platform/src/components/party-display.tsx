"use client";
import { Brand } from "./brand";
import { useEffect, useState } from "react";
import type { getPartySession } from "@/lib/games/party/service";
type View = Awaited<ReturnType<typeof getPartySession>>;
const number = (n: number) => new Intl.NumberFormat("ar-SA-u-nu-latn").format(n);
export function PartyDisplay({ initial }: { initial: View }) {
  const [view, setView] = useState(initial), [error, setError] = useState(""), [fullscreen, setFullscreen] = useState(false), [clock, setClock] = useState(0);
  useEffect(() => { let alive = true; let next: ReturnType<typeof setTimeout>;
    const poll = async () => { try { const response = await fetch(`/api/games/party/sessions/${initial.id}?display=1`, { cache: "no-store" }); if (!response.ok) throw new Error("انقطع تحديث العرض"); if (alive) { setView(await response.json()); setError(""); } }
      catch (cause) { if (alive) setError(cause instanceof Error ? cause.message : "تعذّر التحديث"); } if (alive) next = setTimeout(poll, 1500); };
    next = setTimeout(poll, 1500); return () => { alive = false; clearTimeout(next); }; }, [initial.id]);
  useEffect(() => { const interval = window.setInterval(() => setClock(Date.now()), 1000); const listener = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", listener); return () => { clearInterval(interval); document.removeEventListener("fullscreenchange", listener); }; }, []);
  const { state } = view, card = state.cards[state.index], remaining = state.deadlineAt ? Math.ceil(Math.max(0, new Date(state.deadlineAt).getTime() - clock) / 1000) : Math.ceil(state.remainingMs / 1000);
  return <div className="display-mode party-display"><div className="display-top"><div><span className="display-brand"><Brand/></span><span className="display-caption">{view.title} · الجولة {number(Math.min(state.index + 1, state.cards.length))}</span></div>
    <button className="display-fullscreen" onClick={() => { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => setError("المتصفح منع ملء الشاشة")); }}>{fullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}</button></div>
    {error && <p role="status">{error}</p>}<div className="display-scores">{view.teams.map(team => <div className="display-team" key={team.id} style={{ borderColor: team.color }}><span>{team.name}</span><strong>{number(team.score)}</strong></div>)}{view.players.map(player => <div className="display-team" key={player.id}><span>{player.name}</span><strong>{number(player.score)}</strong></div>)}</div>
    <section className="display-center"><span>{state.phase === "DONE" ? "النتيجة النهائية" : state.phase === "LOBBY" ? "انتظار المضيف" : state.phase.startsWith("PAUSED") ? "المباراة متوقفة" : "التحدي مستمر"}</span>
      {state.phase === "DONE" ? <h1>{(() => { if (state.winnerId) return `الفائز: ${view.teams.find(t => t.id === state.winnerId)?.name}`; const contestants = view.slug === "bluff" ? view.players : view.teams; const highest = Math.max(...contestants.map(t => t.score)); const winners = contestants.filter(t => t.score === highest); return winners.length === 1 ? `الفائز: ${winners[0].name}` : "تعادل!"; })()}</h1>
        : view.slug === "letter-battle" ? <><h1>{state.selected !== null ? card?.question : "اختاروا حرفًا"}</h1><div className="letter-grid">{state.owners.map((owner, index) => <div key={index} className="letter-cell" style={{ background: owner ? view.teams.find(t => t.id === owner)?.color : undefined }}>{(state.cards[index].options as { letter: string }).letter}</div>)}</div></>
        : <><h1>{view.slug === "secret-word" && !state.revealed ? "خمنوا الكلمة من تلميحات المضيف" : card?.question ?? "استعدوا"}</h1>{view.slug === "secret-word" && <div className="display-options">{state.clues.map((clue, index) => <span key={index}>{clue}</span>)}</div>}{view.slug === "bluff" && state.phase === "VOTE" && <div className="display-options">{((card?.options ?? []) as string[]).map((answer, index) => <span key={index}>{answer}</span>)}</div>}{view.slug === "survey-show" || view.slug === "top-list" ? <div className="display-options">{((card?.options ?? []) as { text: string; value: number }[]).map((entry, index) => <span key={index}>{entry.text === "؟" ? "؟" : `${entry.text} · ${entry.value}`}</span>)}</div> : null}
          {view.slug === "fastest-mind" && Array.isArray(card?.options) && <div className="display-options">{(card.options as string[]).map(option => <span key={option}>{option}</span>)}</div>}</>}
      {state.revealed && card?.answer && view.slug !== "secret-word" && <p className="display-answer">الإجابة: {card.answer}</p>}
      {view.status === "IN_PROGRESS" && <div className="display-timer">الوقت {number(remaining)} ث</div>}</section>
  </div>;
}
