"use client";
import { connectLive } from "@/lib/realtime/client";
import {useEffect,useRef,useState} from "react";
import type {BluffView} from "@/lib/games/bluff/service";
import type {Action} from "@/lib/games/bluff/module";
export function useBluffLive(initial:BluffView,audience:"host"|"player"|"display",token?:string){
 const [view,setView]=useState(initial),[error,setError]=useState(""),[busy,setBusy]=useState(false),[connection,setConnection]=useState(""),[ready,setReady]=useState(false),[clock,setClock]=useState(0),[offset,setOffset]=useState(()=>Date.parse(initial.serverNow)-Date.now());
 const version=useRef(initial.version),pending=useRef<{payload:string;key:string}|null>(null);
 const endpoint=`/api/bluff/${initial.id}${audience==="host"?"":audience==="player"?"/player":`/display?token=${encodeURIComponent(token??"")}`}`;
  useEffect(()=>{
    let alive=true;
    const live=connectLive<BluffView>({
      events:`/api/bluff/${initial.id}/events?audience=${audience}${audience ==="display"?`&token=${encodeURIComponent(token??"")}`:""}`,endpoint,now:Date.now,
      apply:(next,sent)=>{if(!alive||next.version<version.current)return;version.current=next.version;setView(next);setOffset(Date.parse(next.serverNow)-(sent+Date.now())/2);setConnection("");setReady(true);},
      temporary:()=>{if(alive)setConnection("جارٍ إعادة الاتصال…");},
      terminal:()=>{if(alive){setReady(false);setConnection("انتهى الوصول إلى المباراة أو الرابط.");setView(current=>({...current,self: current.self ? { ...current.self, fakeAnswer: null, ownChoiceId: null, choiceId: null } : null, moderationQueue: [], question: null}));}},
    });
    const timer=setInterval(()=>setClock(Date.now()),200);
    return()=>{alive=false;live.close();clearInterval(timer);};
  },[initial.id,audience,token,endpoint]);
 async function send(action:Action){if(busy)return false;setBusy(true);setError("");const payload=JSON.stringify(action);if(pending.current?.payload!==payload)pending.current={payload,key:crypto.randomUUID()};const key=pending.current.key;let expectedVersion=view.version;
  try{for(let attempt=0;attempt<5;attempt++){
   const sent=Date.now(),r=await fetch(`/api/bluff/${view.id}/commands`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,expectedVersion,action})}),data=await r.json();
   if(r.ok){if(data.session.version>=version.current){version.current=data.session.version;setView(data.session);}setOffset(Date.parse(data.session.serverNow)-(sent+Date.now())/2);pending.current=null;return true;}
   if(data.code!=="STALE_GAME_STATE"){pending.current=null;throw new Error(data.error??"تعذّر تنفيذ الإجراء");}
   const current=await fetch(endpoint,{cache:"no-store"});if(!current.ok)throw new Error("تعذّر تحديث المباراة");const fresh=await current.json() as BluffView;expectedVersion=fresh.version;if(fresh.version>=version.current){version.current=fresh.version;setView(fresh);}
  }throw new Error("تغيّرت المباراة؛ حاول مجددًا");}catch(cause){setError(cause instanceof Error?cause.message:"تعذّر الاتصال");return false;}finally{setBusy(false);}
 }
 const serverTime=clock?clock+offset:Date.parse(view.serverNow),remaining=view.phase==="PAUSED"?view.remainingMs??0:view.deadlineAt?Math.max(0,Date.parse(view.deadlineAt)-serverTime):0;
 return {view,error,busy,connection,ready,send,remaining};
}
