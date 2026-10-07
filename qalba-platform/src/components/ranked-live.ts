"use client";
import { connectLive } from "@/lib/realtime/client";
import {useState,useEffect,useRef} from "react";
import type {RankedView} from "@/lib/games/ranked/service";
import type {Action} from "@/lib/games/ranked/module";
import { createRankedIntentTracker } from "@/lib/games/ranked/client-intent";
export function useRankedLive(initial:RankedView,audience:"host"|"display",token?:string){
 const [view,setView]=useState(initial),[error,setError]=useState(""),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[connection,setConnection]=useState(""),[tick,setTick]=useState(0);
 const version=useRef(initial.version),anchor=useRef({server:Date.parse(initial.serverNow),local:0}),intents=useRef(createRankedIntentTracker(initial)),inFlight=useRef(false);
 function accept(next:RankedView,sent=performance.now()) { if(!intents.current.observe(next))return;version.current=next.version;setView(next);anchor.current={server:Date.parse(next.serverNow)+(performance.now()-sent)/2,local:performance.now()}; }
 const endpoint=`/api/ranked/${initial.id}${audience==="display"?`/display?token=${encodeURIComponent(token??"")}`:""}`;
  useEffect(()=>{
    let alive=true;anchor.current={server:Date.parse(initial.serverNow),local:performance.now()};
    const live=connectLive<RankedView>({
      events:`/api/ranked/${initial.id}/events?audience=${audience}${audience ==="display"?`&token=${encodeURIComponent(token??"")}`:""}`,endpoint,now:()=>performance.now(),
      apply:(next,sent)=>{if(!alive||next.version<version.current)return;accept(next,sent);setConnection("");setReady(true);},
      temporary:()=>{if(alive)setConnection("جارٍ إعادة الاتصال…");},
      terminal:()=>{if(alive){intents.current.clear();setReady(false);setConnection("انتهى الوصول إلى المباراة أو الرابط.");setView(current=>({...current,slots: current.slots.map(slot => ({ ...slot, answer: undefined, displayValue: undefined })), question: null}));}},
    });
    const timer=setInterval(()=>setTick(anchor.current.server+Math.max(0,performance.now()-anchor.current.local)),200);
    return()=>{alive=false;live.close();clearInterval(timer);};
  },[initial.id,initial.serverNow,audience,token,endpoint]);
 async function send(action:Action){
  if(inFlight.current||audience!=="host")return false;
  inFlight.current=true;setBusy(true);setError("");const intent=intents.current.begin(action);
  try{const sent=performance.now(),r=await fetch(`/api/ranked/${initial.id}/commands`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:intent.key,expectedVersion:intent.expectedVersion,action})}),data=await r.json();
   if(!r.ok){if(r.status<500&&r.status!==429)intents.current.finish(intent);const refreshed=await fetch(endpoint,{cache:"no-store"});if(refreshed.ok)accept(await refreshed.json() as RankedView);throw new Error(data.error??"تعذر الإجراء");}
   accept(data.session,sent);intents.current.finish(intent);return true;
  }catch(e){setError(e instanceof Error?e.message:"تعذر الاتصال");return false;}
  finally{inFlight.current=false;setBusy(false);}
 }
 const serverNow=tick||Date.parse(view.serverNow),remaining=view.phase==="PAUSED"?view.remainingMs??0:view.deadlineAt?Math.max(0,Date.parse(view.deadlineAt)-serverNow):0;
 return {view,error,busy,ready,connection,send,remaining};
}
