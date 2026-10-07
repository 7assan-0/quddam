"use client";
import type {ForbiddenView,ClueView} from "@/lib/games/forbidden-word/service";
import {useForbiddenLive} from "./forbidden-live";
import {ForbiddenCard,ForbiddenTimer} from "./forbidden-stage";
export function ForbiddenClue({initial,token}:{initial:ForbiddenView;token:string}){const live=useForbiddenLive(initial,"clue",token),view=live.view as ClueView;return <div className="shell forbidden-page forbidden-phone" data-phase={view.phase}><div className="page-title"><span className="eyebrow">الكلمة الممنوعة · بطاقة خاصة</span><h1>مقدّم التلميحات</h1><p>الجولة {view.roundNumber} · {view.teams.find(t=>t.id===view.activeTeamId)?.name}</p></div>{live.connection&&<p role="status">{live.connection}</p>}<ForbiddenTimer seconds={live.seconds} paused={view.phase==="PAUSED"}/><ForbiddenCard card={view.card}/><p>الأحكام من شاشة المضيف. لا تُظهر هذه البطاقة لبقية الفريق.</p></div>;}
