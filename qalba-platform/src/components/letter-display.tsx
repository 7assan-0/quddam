"use client";
import { Brand } from "./brand";
import type { LetterView } from "@/lib/games/letter-network/service";
import { useLetterLive } from "./letter-live";
import { LetterBoard,LetterTeams } from "./letter-board";
export function LetterDisplay({initial,token}:{initial:LetterView;token:string}){
  const {view,connection,seconds}=useLetterLive(initial,"display",token);
  const team=view.teams.find(t=>t.id===view.answeringTeamId),winner=view.teams.find(t=>t.id===view.winnerTeamId);
  return <div className="display-mode letter-page letter-tv" aria-label="شاشة عرض شبكة الحروف">
    <div className="display-top"><div><span className="display-brand"><Brand/></span><span className="display-caption">شبكة الحروف · الجولة {view.matchNumber||1}</span></div><span className="display-status">{view.phase==="PAUSED"?"توقف مؤقت":view.phase==="COMPLETED"?"النتيجة النهائية":"الدور: "+(team?.name??"قريبًا")}</span></div>
    {connection&&<p role="status" className="display-connection">{connection}</p>}
    <LetterTeams view={view}/><div className="letter-layout">{view.board.length>0&&<LetterBoard view={view}/>}
      <section className="letter-tv-stage" aria-live="polite">
        {view.phase==="LOBBY"&&<h1>الفريقان يجهّزان المباراة</h1>}
        {view.phase==="READY"&&<><span>الدور: {team?.name}</span><h1>اختاروا حرفكم</h1></>}
        {view.phase==="CELL_SELECTED"&&<><span>الحرف المختار</span><h1>{view.board.find(c=>c.cellId===view.activeCellId)?.letter}</h1><p>السؤال يبدأ بعد لحظات</p></>}
        {view.question&&<><span>{view.phase==="STEAL"?"فرصة الاقتناص":"السؤال"} · {team?.name}</span><h1>{view.question.text}</h1><p>الإجابة تبدأ بحرف {view.question.letter}</p><div className="letter-timer" aria-label="الوقت المتبقي">{seconds} ث</div></>}
        {view.phase==="PAUSED"&&<h2>المباراة متوقفة مؤقتًا</h2>}
        {["RESULTS","COMPLETED"].includes(view.phase)&&<><span>المسار اكتمل</span><h1>{winner?"فاز "+winner.name+"!":"انتهت المباراة دون فائز"}</h1></>}
        {view.lastAnswer&&<p>إجابة السؤال السابق: {view.lastAnswer.answer}</p>}
        {view.phase==="ABANDONED"&&<h1>أُلغيت المباراة</h1>}
      </section>
    </div>
  </div>;
}

