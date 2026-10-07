"use client";
import { connectLive } from "@/lib/realtime/client";
import { useEffect,useRef,useState,useSyncExternalStore } from "react";
import type { SurveyView } from "@/lib/games/survey-battle/service";
import type { Action } from "@/lib/games/survey-battle/module";
const subscribe=()=>()=>{};
export function useSurveyLive(initial:SurveyView,audience:"host"|"display",token?:string){
  const [view,setView]=useState(initial),[error,setError]=useState(""),[busy,setBusy]=useState(false),[connection,setConnection]=useState("");
  const version=useRef(initial.version),sending=useRef(false),hydrated=useSyncExternalStore(subscribe,()=>true,()=>false);
  const endpoint="/api/survey-show/"+initial.id+(audience==="display"?"/display?token="+encodeURIComponent(token??""):"");
  useEffect(()=>{
    let alive=true;
    const live=connectLive<SurveyView>({
      events:`/api/survey-show/${initial.id}/events?audience=${audience}${audience ==="display"?`&token=${encodeURIComponent(token??"")}`:""}`,endpoint,now:Date.now,
      apply:(next)=>{if(!alive||next.version<version.current)return;version.current=next.version;setView(next);setConnection("");},
      temporary:()=>{if(alive)setConnection("جارٍ إعادة الاتصال…");},
      terminal:()=>{if(alive){setConnection("انتهى الوصول إلى المباراة أو الرابط.");setView(current=>({...current,answers: [], question: null}));}},
    });
    
    return()=>{alive=false;live.close();};
  },[initial.id,audience,token,endpoint]);
  async function send(action:Action){
    if(sending.current||audience!=="host")return;sending.current=true;setBusy(true);setError("");
    try{const response=await fetch("/api/survey-show/"+view.id+"/commands",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:crypto.randomUUID(),expectedVersion:version.current,action})});const data=await response.json();
      if(!response.ok){const response=await fetch(endpoint,{cache:"no-store"});if(response.ok){const next=await response.json();if(next.version>=version.current){version.current=next.version;setView(next);}}throw new Error(data.error??"تعذّر تنفيذ الإجراء");}
      if(data.session.version>=version.current){version.current=data.session.version;setView(data.session);}
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذّر تنفيذ الإجراء");}finally{sending.current=false;setBusy(false);}
  }
  return {view,error,setError,busy:busy||!hydrated,connection,hydrated,send};
}
