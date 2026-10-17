import { formatNumber } from "@/lib/format-number";
"use client";
import { TeamMarker } from "./team-marker";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { getPartySession } from "@/lib/games/party/service";
import type { PartyAction } from "@/lib/games/party/types";

type View = Awaited<ReturnType<typeof getPartySession>>;
type Entry = { text: string; value: number };

export function PartyHost({ initial }: { initial: View }) {
  const [view, setView] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [teamId, setTeamId] = useState(initial.teams[0]?.id ?? ""), [playerId, setPlayerId] = useState(initial.players[0]?.id ?? ""), [value, setValue] = useState(""), [clock, setClock] = useState(Date.now());
  useEffect(() => { const interval = window.setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(interval); }, []);
  async function send(action: PartyAction) {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try { const response = await fetch(`/api/games/party/sessions/${view.id}/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: crypto.randomUUID(), expectedVersion: view.version, action }) });
      const result = await response.json(); if (!response.ok) { if (response.status === 409) { const refreshed = await fetch(`/api/games/party/sessions/${view.id}`); if (refreshed.ok) setView(await refreshed.json()); } throw new Error(result.error ?? "تعذّر تنفيذ الأمر"); }
      setView(result.session); setValue(""); setMessage("حُفظ الإجراء");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الاتصال"); } finally { setBusy(false); }
  }
  const { state } = view, card = state.cards[state.index], phase = state.phase, active = view.status !== "LOBBY" && view.status !== "COMPLETED";
  const remaining = state.deadlineAt ? Math.ceil(Math.max(0, new Date(state.deadlineAt).getTime() - clock) / 1000) : Math.ceil(state.remainingMs / 1000);
  const button = (label: string, action: PartyAction, disabled = false) => <button type="button" className="btn btn-secondary" disabled={busy || disabled} onClick={() => void send(action)}>{label}</button>;
  const selector = <select className="input" aria-label="اختر الفريق" value={teamId} onChange={e => setTeamId(e.target.value)}>{view.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select>;
  const playerSelector = <select className="input" aria-label="اختر اللاعب" value={playerId} onChange={e => setPlayerId(e.target.value)}>{view.players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select>;
  const answerField = <input className="input" aria-label="إجابة أو تخمين" value={value} maxLength={300} onChange={e => setValue(e.target.value)} placeholder="اكتب الإجابة هنا" />;
  const scores = <div className="display-scores" aria-label="النتائج">{view.teams.map((team, index) => <div className="display-team" key={team.id} style={{ borderColor: team.color }}><span><TeamMarker position={index} color={team.color} />{team.name}</span><strong>{formatNumber(team.score)}</strong></div>)}{view.players.map(player => <div className="display-team" key={player.id}><span>{player.name}</span><strong>{formatNumber(player.score)}</strong></div>)}</div>;
  return <div className="shell section party-host"><div className="page-title"><span className="eyebrow">{view.title} · الجولة {formatNumber(Math.min(state.index + 1, state.cards.length))}</span><h1>{phase === "DONE" ? "النتيجة النهائية" : "اقلبوا النتيجة"}</h1></div>
    {scores}<div className="utility-links"><Link className="btn btn-secondary" href="/games">مكتبة الألعاب</Link><Link className="btn btn-secondary" href={`/play/${view.id}/display`} target="_blank">شاشة العرض</Link>
      {view.status === "LOBBY" && button("ابدأ المباراة", { type: "START" })}
      {active && (phase.startsWith("PAUSED:") ? button("استئناف", { type: "RESUME" }) : button("إيقاف مؤقت", { type: "PAUSE" }))}
      {active && button("إنهاء المباراة", { type: "END" })}</div>
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="form-note">{message}</p>}
    {phase === "DONE" && <section className="panel party-stage"><h2>{(() => { const contestants = view.slug === "bluff" ? view.players : view.teams; const winners = contestants.filter(item => item.score === Math.max(...contestants.map(t => t.score))); return state.winnerId ? `الفائز: ${view.teams.find(t => t.id === state.winnerId)?.name}` : winners.length === 1 ? `الفائز: ${winners[0].name}` : "تعادل!"; })()}</h2>
      <Link className="btn btn-primary" href={`/games/${view.slug}/new`}>مباراة جديدة</Link></section>}
    {phase !== "LOBBY" && phase !== "DONE" && !phase.startsWith("PAUSED:") && <section className="panel party-stage">
      {view.slug === "letter-battle" ? <><h2>كوّنوا مسارًا متصلًا</h2><p>الفريق الأول من أعلى إلى أسفل، والثاني من اليمين إلى اليسار.</p>
        <div className="letter-grid">{state.owners.map((owner, index) => <button key={index} className="letter-cell" style={{ background: owner ? view.teams.find(t => t.id === owner)?.color : undefined }} disabled={busy || phase !== "BOARD" || Boolean(owner)} onClick={() => void send({ type: "OPEN", index })}>{(state.cards[index].options as { letter: string }).letter}</button>)}</div>
        {phase === "BOARD" && button("تراجع عن آخر احتلال", { type: "UNDO" })}
        {phase === "QUESTION" && <><h2>{card.question}</h2><p>تبدأ الإجابة بحرف {(card.options as { letter: string }).letter}</p>{state.revealed && <p className="answer-reveal">الإجابة: {card.answer}</p>}
          <div className="party-actions">{selector}{button("احتل الحرف", { type: "CAPTURE", teamId })}{button("اكشف الإجابة", { type: "REVEAL" })}{button("سؤال بديل", { type: "REPLACE" })}{button("تخطَّ", { type: "SKIP" })}</div></>}
      </> : <><h2>{view.slug === "secret-word" ? "الكلمة: " : "السؤال: "}{card?.question}</h2>
        {view.slug === "party-court" && <p>المتهم: {view.players[state.index % view.players.length]?.name} · الادعاء: {(card.options as { prosecution: string }).prosecution} · الدفاع: {(card.options as { defense: string }).defense}</p>}
        {view.slug === "secret-word" && <p>الكلمات الممنوعة: {(card.options as { forbidden: string[] }).forbidden.join("، ")}</p>}
        {view.slug === "fastest-mind" && Array.isArray(card.options) && <div className="display-options">{(card.options as string[]).map(option => <span key={option}>{option}</span>)}</div>}
        {(view.slug === "top-list" || view.slug === "survey-show") && <div className="display-options">{(card.options as Entry[]).map((entry, index) => <span key={index}>{state.found.includes(index) || state.revealed ? `${entry.text} · ${entry.value}` : "؟"}</span>)}</div>}
        {state.revealed && <p className="answer-reveal">الإجابة: {card.answer}</p>}
        <div className="party-actions">{button(state.deadlineAt ? "أوقف المؤقت" : "شغّل المؤقت", { type: "TIMER" }, !["QUESTION", "SUBMIT", "VOTE", "ARGUE"].includes(phase))}<strong>الوقت {formatNumber(remaining)} ث</strong>{view.slug === "fastest-mind" && state.deadlineAt && remaining <= 0 && button("انتهى الوقت", { type: "TIMEOUT" })}</div>
        {view.slug === "bluff" && <div className="party-actions">{phase === "SUBMIT" && <>{playerSelector}{answerField}{button("سجّل الإجابة المموهة", { type: "FAKE", playerId, value }, !value.trim())}<p>{Object.keys(state.fakes).length} من {state.playerIds.length} أجابوا</p>{button("ابدأ التصويت", { type: "VOTING" }, Object.keys(state.fakes).length !== state.playerIds.length)}</>}
          {phase === "VOTE" && <>{playerSelector}<select className="input" aria-label="اختر الإجابة" value={value} onChange={e => setValue(e.target.value)}><option value="">اختر إجابة</option><option value="correct">{card.answer}</option>{Object.entries(state.fakes).map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select>{button("سجّل التصويت", { type: "VOTE", playerId, value }, !value)}<p>{Object.keys(state.votes).length} من {state.playerIds.length} صوتوا</p>{button("اعرض النتيجة", { type: "RESULT" }, Object.keys(state.votes).length !== state.playerIds.length)}</>}
        </div>}
        {view.slug === "fastest-mind" && phase === "QUESTION" && <div className="party-actions">{selector}{Array.isArray(card.options) ? <select className="input" aria-label="الإجابة" value={value} onChange={e => setValue(e.target.value)}><option value="">اختر إجابة</option>{(card.options as string[]).map(option => <option key={option}>{option}</option>)}</select> : answerField}{button("ثبّت الإجابة", { type: "ANSWER", teamId, value }, !value.trim())}</div>}
        {view.slug === "top-list" && phase === "QUESTION" && <div className="party-actions">{selector}{answerField}{button("اكشف العنصر", { type: "GUESS", teamId, value }, !value.trim())}{button("اكشف القائمة", { type: "REVEAL" })}</div>}
        {view.slug === "secret-word" && phase === "QUESTION" && <div className="party-actions">{answerField}{button("أضف تلميحًا", { type: "CLUE", value }, !value.trim())}<p>التلميحات: {state.clues.join("، ") || "لم تبدأ بعد"}</p>{selector}{button("صحيح", { type: "JUDGE", teamId, value: "correct" })}{button("انتهى الوقت", { type: "JUDGE", value: "wrong" })}</div>}
        {view.slug === "survey-show" && ["QUESTION", "STEAL"].includes(phase) && <div className="party-actions">{selector}{answerField}{button(phase === "STEAL" ? "محاولة سرقة" : "ثبّت التخمين", { type: "GUESS", teamId, value }, !value.trim())}<span>الأخطاء: {state.strikes}</span>{button("اكشف الباقي", { type: "REVEAL" })}</div>}
        {view.slug === "party-court" && <div className="party-actions">{phase === "ARGUE" && button("انتهت المرافعات · افتح التصويت", { type: "VOTING" })}{phase === "VOTE" && <>{playerSelector}<select className="input" aria-label="الحكم" value={value} onChange={e => setValue(e.target.value)}><option value="">اختر الطرف</option><option value="prosecution">الادعاء</option><option value="defense">الدفاع</option></select>{button("ثبّت الحكم", { type: "VOTE", playerId, value }, !value)}<span>{Object.keys(state.votes).length} من {state.playerIds.length} صوتوا</span>{button("أعلن الحكم", { type: "RESULT" }, Object.keys(state.votes).length !== state.playerIds.length)}</>}</div>}
        {phase === "RESULT" && button("السؤال التالي", { type: "NEXT" })}
      </>}
    </section>}
  </div>;
}
