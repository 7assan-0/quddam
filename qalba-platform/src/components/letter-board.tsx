"use client";
import { TeamMarker } from "./team-marker";
import type { LetterView } from "@/lib/games/letter-network/service";
export function LetterBoard({view,onSelect,disabled=false}:{view:LetterView;onSelect?:(id:string)=>void;disabled?:boolean}){
  return <div className="letter-board-wrap"><p className="letter-edge">الفريق ب: أعلى ↕ أسفل</p>
    <div className="letter-board" dir="ltr" role="group" aria-label="شبكة الحروف، خمسة صفوف وخمسة أعمدة">
      {[0,1,2,3,4].map(row=><div className={"letter-row "+(row%2?"letter-row-offset":"")} key={row}>
        {view.board.filter(c=>c.row===row).map(cell=>{
          const team=view.teams.find(t=>t.id===cell.ownerTeamId),winning=view.winningPath.includes(cell.cellId);
          const label="الحرف "+cell.letter+"، صف "+(cell.row+1)+"، عمود "+(cell.col+1)+"، "+(team?"ملك "+team.name:cell.state==="ACTIVE"?"السؤال النشط":"متاحة");
          const content=<><span>{cell.letter}</span>{team&&<small>{team.position===0?"أ":"ب"}</small>}{winning&&<span className="visually-hidden">ضمن المسار الفائز</span>}</>;
          const props={className:"letter-cell "+(team?"letter-owned ":"")+(cell.state==="ACTIVE"?"letter-active ":"")+(winning?"letter-winning":""),style:{"--letter-owner":team?.color} as React.CSSProperties,"aria-label":label,"data-cell":cell.cellId,"data-owner":team?.position??"","data-winning":winning?"true":"false"};
          return onSelect?<button {...props} key={cell.cellId} disabled={disabled||view.phase!=="READY"||cell.state!=="AVAILABLE"} onClick={()=>onSelect(cell.cellId)}>{content}</button>
            :<div {...props} key={cell.cellId} role="img">{content}</div>;
        })}
      </div>)}
    </div><p className="letter-edge">الفريق أ: يسار ↔ يمين</p>
  </div>;
}
export function LetterTeams({view}:{view:LetterView}){
  return <div className="letter-teams">{view.teams.map(t=><div className={"panel letter-team "+(view.answeringTeamId===t.id?"letter-team-active":"")} key={t.id} style={{borderColor:t.color}}>
    <strong><TeamMarker position={t.position} color={t.color} /><span style={{color:t.color}}>{t.position===0?"أ":"ب"}</span> · {t.name}</strong><span>{t.captured} خلايا · {t.position===0?"يسار إلى يمين":"أعلى إلى أسفل"}</span>
    {view.answeringTeamId===t.id&&!["RESULTS","COMPLETED","ABANDONED","LOBBY"].includes(view.phase)&&<small>الدور الآن</small>}
  </div>)}</div>;
}

