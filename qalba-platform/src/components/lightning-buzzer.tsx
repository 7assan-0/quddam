"use client";
import { teamColor } from "@/lib/design/team-colors";
import { TeamMarker } from "./team-marker";
import type { CSSProperties } from "react";
import type { LightningView } from "@/lib/games/lightning/service";
import { useLightningLive } from "./lightning-live";
export function LightningBuzzer({ initial, token }: { initial: LightningView; token: string }) {
  const { view, remaining, ready, busy, connection, error, send } = useLightningLive(initial, "buzzer", token), team = view.teams.find(t => t.id === view.teamId), own = view.buzzWinnerTeamId === view.teamId, other = view.teams.find(t => t.id === view.buzzWinnerTeamId), label = view.phase === "PAUSED" ? "متوقف مؤقتًا" : view.canBuzz ? "اضغط! ⚡" : view.buzzWinnerTeamId ? own ? "أنت أول!" : `سبقكم ${other?.name ?? "الفريق الثاني"}` : "استعد";
  return <div className="shell lightning-phone" style={{ "--lightning-team": team ? teamColor(team.position) : undefined } as CSSProperties} data-phase={view.phase} data-live-ready={ready} data-team-id={view.teamId}><div className="page-title"><h1>جرس البرق</h1><h2>{team && <TeamMarker position={team.position} color={team.color} />}الفريق {team?.position === 0 ? "A" : "B"} · {team?.name}</h2></div><p role="status" aria-label="حالة اتصال الجرس">{connection}</p><p>السؤال {view.questionNumber} / {view.questionCount}</p><button className="lightning-buzzer" disabled={!ready || busy || !view.canBuzz} onClick={() => void send({ type: "BUZZ" })} aria-label={view.canBuzz ? "اضغط الجرس" : label}>{label}</button>{(view.deadlineAt || view.remainingMs !== null) && <output className="timer" aria-label="الوقت المتبقي" data-ms={Math.round(remaining)}>{Math.ceil(remaining / 1000)} ثانية</output>}{error && <p role="alert" className="form-error">{error}</p>}<p className="muted">هذا الجرس لفريقك فقط. المضيف يحكم الإجابة.</p></div>;
}
