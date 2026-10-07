"use client";
import { connectLive } from "@/lib/realtime/client";
import { useEffect,useRef,useState,useSyncExternalStore } from "react";
import type { ForbiddenView } from "@/lib/games/forbidden-word/service";
import type { Action } from "@/lib/games/forbidden-word/module";
const hydrationSubscribe=()=>()=>{};
export function useForbiddenLive(initial:ForbiddenView,audience:"host"|"display"|"clue",token?:string){
  const [view,setView]=useState(initial),[error,setError]=useState(""),[busy,setBusy]=useState(false),[connection,setConnection]=useState("");
  const [clock,setClock]=useState(0),[offset,setOffset]=useState(()=>new Date(initial.serverNow).getTime()-Date.now());
  const version=useRef(initial.version),sending=useRef(false);
  const hydrated=useSyncExternalStore(hydrationSubscribe,()=>true,()=>false);
  const endpoint="/api/secret-word/"+initial.id+(audience!=="host"?"/"+audience+"?token="+encodeURIComponent(token??""):"");
  useEffect(()=>{
    let alive=true;
    const live=connectLive<ForbiddenView>({
      events:`/api/secret-word/${initial.id}/events?audience=${audience}${audience !=="host"?`&token=${encodeURIComponent(token??"")}`:""}`,endpoint,now:Date.now,
      apply:(next,sent)=>{if(!alive||next.version<version.current)return;version.current=next.version;setView(next);setOffset(Date.parse(next.serverNow)-(sent+Date.now())/2);setConnection("");},
      temporary:()=>{if(alive)setConnection("جارٍ إعادة الاتصال…");},
      terminal:()=>{if(alive){setConnection("انتهى الوصول إلى المباراة أو الرابط.");setView(current=>({...current,card: null}));}},
    });
    const timer=setInterval(()=>setClock(Date.now()),250);
    return()=>{alive=false;live.close();clearInterval(timer);};
  },[initial.id,audience,token,endpoint]);
  async function send(action:Action){
    if(sending.current||audience!=="host")return;sending.current=true;setBusy(true);setError("");
    const key=crypto.randomUUID(),expectedVersion=version.current;
    try{
      const response=await fetch("/api/secret-word/"+view.id+"/commands",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,expectedVersion,action})});
      const data=await response.json();
      if(!response.ok){
        const fresh=await fetch(endpoint,{cache:"no-store"});if(fresh.ok){const next=await fresh.json();if(next.version>=version.current){version.current=next.version;setView(next);}}
        throw new Error(data.error??"تعذّر تنفيذ الإجراء");
      }
      if(data.session.version>=version.current){version.current=data.session.version;setView(data.session);}
      setOffset(new Date(data.session.serverNow).getTime()-Date.now());
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذّر تنفيذ الإجراء");}
    finally{sending.current=false;setBusy(false);}
  }
  const now=clock?clock+offset:new Date(view.serverNow).getTime();
  const seconds=view.deadlineAt?Math.max(0,Math.ceil((new Date(view.deadlineAt).getTime()-now)/1000)):Math.ceil(view.remainingMs/1000);
  return {view,error,setError,busy:busy||!hydrated,connection,seconds,send,hydrated};
}
