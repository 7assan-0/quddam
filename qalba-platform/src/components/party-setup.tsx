"use client";
import { CreateCopy } from "./cta-copy";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PartySlug } from "@/lib/games/party/types";

export function PartySetup({ slug, title }: { slug: PartySlug; title: string }) {
  const router = useRouter(); const [teamNames, setTeams] = useState<[string, string]>(["فريق البرق", "فريق الموج"]);
  const [playerNames, setPlayers] = useState("أحمد، نورة، خالد"); const [timerSeconds, setTimer] = useState(30);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const playersNeeded = slug === "bluff" || slug === "party-court";
  async function create(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError("");
    try { const response = await fetch(`/api/games/party/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamNames, playerNames: playersNeeded ? playerNames.split(/[،,\n]/).map(x => x.trim()).filter(Boolean) : [], timerSeconds }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "تعذّر تجهيز اللعبة"); router.push(`/play/${result.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر تجهيز اللعبة"); } finally { setBusy(false); } }
  return <div className="shell section"><div className="page-title"><span className="eyebrow">جهزوا جمعتكم</span><h1>{title}</h1><p>اكتبوا أسماء الفرق واللاعبين ثم افتحوا المباراة. يبدأ خصم رصيد اللعبة عند ضغط «ابدأ المباراة».</p></div>
    <form className="panel auth-card" onSubmit={event => void create(event)}><h2>إعداد المباراة</h2>{teamNames.map((team, index) => <div className="field" key={index}><label htmlFor={`team-${index}`}>الفريق {index + 1}</label><input id={`team-${index}`} className="input" minLength={1} maxLength={60} value={team} onChange={event => setTeams(index === 0 ? [event.target.value, teamNames[1]] : [teamNames[0], event.target.value])} required /></div>)}
      {playersNeeded && <div className="field"><label htmlFor="players">اللاعبون (3–10، افصل بينهم بفاصلة)</label><textarea id="players" className="input" value={playerNames} onChange={event => setPlayers(event.target.value)} required /></div>}
      <div className="field"><label htmlFor="seconds">وقت السؤال بالثواني</label><input id="seconds" className="input" type="number" min="10" max="180" value={timerSeconds} onChange={event => setTimer(Number(event.target.value))} /></div>
      {error && <p role="alert" className="form-error">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? "جاري تجهيز اللعبة..." : <CreateCopy previous="جهّز اللعبة"/>}</button></form></div>;
}
