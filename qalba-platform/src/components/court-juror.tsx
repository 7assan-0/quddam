'use client';
import type {CourtView} from '@/lib/games/court/service';
import {useCourtLive} from './court-live';
import {CourtStage} from './court-stage';
export function CourtJuror({initial}:{initial:CourtView}) {const {view,remaining,ready,busy,error,connection,send}=useCourtLive(initial,'juror');const self=view.participants.find(p=>p.id===view.self?.id);
 return <div className="shell court-phone" data-phase={view.phase} data-live-ready={ready}><div className="page-title"><h1>المحكمة</h1><p>المحلف: {self?.name}</p></div>{connection!=='متصل'&&<p role="status">{connection}</p>}{error&&<p role="alert">{error}</p>}{view.canVote&&<section className="panel court-vote"><h2>لمن تقنعك الحجة؟</h2><button className="btn btn-primary" disabled={!ready||busy||remaining<=0} onClick={()=>void send({type:'VOTE',choice:'PROSECUTION'})}>مع الادعاء</button><button className="btn btn-secondary" disabled={!ready||busy||remaining<=0} onClick={()=>void send({type:'VOTE',choice:'DEFENSE'})}>مع الدفاع</button><p>صوت واحد خاص، ولا يمكن تغييره بعد الإرسال.</p></section>}{view.self?.voted&&<p className="panel" role="status">تم تسجيل صوتك · {view.self.choice==='PROSECUTION'?'مع الادعاء':'مع الدفاع'}</p>}<CourtStage view={view} remaining={remaining}/>{view.phase==='LOBBY'&&<p className="panel">بانتظار بدء المحكمة. أبقِ هذه الصفحة لاستعادة هويتك.</p>}</div>;
}
