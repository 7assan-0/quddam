"use client";
import { Brand } from "./brand";
import type {ForbiddenView} from "@/lib/games/forbidden-word/service";
import {useForbiddenLive} from "./forbidden-live";
import {ForbiddenTeams,ForbiddenTimer,ForbiddenSummary,ForbiddenResult} from "./forbidden-stage";
export function ForbiddenDisplay({initial,token}:{initial:ForbiddenView;token:string}){const live=useForbiddenLive(initial,"display",token),view=live.view;const feedback=view.lastEvent.includes("CARD_CORRECT")?"إجابة صحيحة":view.lastEvent.includes("CARD_SKIPPED")?"تجاوز":view.lastEvent.includes("FOUL_RECORDED")?"كلمة ممنوعة":"";
return <div className="display-mode forbidden-page forbidden-tv" data-version={view.version} data-phase={view.phase} aria-label="شاشة عرض الكلمة الممنوعة"><div className="display-top"><div><span className="display-brand"><Brand/></span><span className="display-caption">الكلمة الممنوعة · الجولة {view.roundNumber} / {view.roundCount}</span></div><span className="display-status">{view.phase==="PAUSED"?"توقف مؤقت":view.phase==="CARD_ACTIVE"?"صفها… دون المحظور":"جهّزوا الفريقين"}</span></div>{live.connection&&<p role="status">{live.connection}</p>}<ForbiddenTeams view={view}/><section className="forbidden-stage"><h1>{view.teams.find(t=>t.id===view.activeTeamId)?.name??"الكلمة الممنوعة"}</h1>{["CARD_ACTIVE","PAUSED"].includes(view.phase)&&<ForbiddenTimer seconds={live.seconds} paused={view.phase==="PAUSED"}/>}<ForbiddenSummary view={view}/><p role="status" className="forbidden-feedback" key={view.version}>{feedback}</p><ForbiddenResult view={view}/></section></div>;
}
