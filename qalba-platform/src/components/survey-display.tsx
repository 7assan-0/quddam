"use client";
import { Brand } from "./brand";
import type { SurveyView } from "@/lib/games/survey-battle/service";
import { useSurveyLive } from "./survey-live";
import { SurveyBoard,SurveyTeams,SurveyStatus } from "./survey-board";
export function SurveyDisplay({initial,token}:{initial:SurveyView;token:string}){
  const {view,connection}=useSurveyLive(initial,"display",token),team=view.teams.find(t=>t.id===view.activeTeamId),winner=view.teams.find(t=>t.id===view.winnerTeamId),roundWinner=view.teams.find(t=>t.id===view.roundWinnerId);
  return <div className="display-mode survey-page survey-tv" data-version={view.version} data-phase={view.phase} aria-label="شاشة عرض قالوا الناس"><div className="display-top"><div><span className="display-brand"><Brand/></span><span className="display-caption">قالوا الناس · الجولة {view.roundNumber} / {view.roundCount} · ×{view.multiplier}</span></div><span className="display-status">{view.phase==="PAUSED"?"توقف مؤقت":view.phase==="STEAL"?"فرصة الاقتناص · "+team?.name:team?"الفريق النشط · "+team.name:"المواجهة"}</span></div>{connection&&<p role="status">{connection}</p>}<SurveyTeams view={view}/><section className="survey-stage" aria-label="الجولة الحالية"><span className="muted">محتوى محرّر للعبة · ليست نتائج استطلاع حقيقي</span><h1>{view.question?.text??"الفريقان يجهّزان المباراة"}</h1>{view.phase==="PAUSED"&&<h2>المباراة متوقفة مؤقتًا</h2>}<SurveyBoard view={view}/><SurveyStatus view={view}/>{view.phase==="ROUND_RESULTS"&&<h2>نقاط الجولة لـ{roundWinner?.name} · {view.finalPot}</h2>}{["FINAL_RESULTS","COMPLETED"].includes(view.phase)&&<h2>{winner?"فاز "+winner.name+"!":"تعادل الفريقان"}</h2>}{view.phase==="ABANDONED"&&<h2>أُلغيت المباراة</h2>}</section></div>;
}
