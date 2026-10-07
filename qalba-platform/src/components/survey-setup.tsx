"use client";
import { CreateCopy } from "./cta-copy";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SurveySetup(){
  const router=useRouter(),[names,setNames]=useState<[string,string]>(["الفريق الأول","الفريق الثاني"]),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function create(event:React.FormEvent){event.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/survey-show",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({names})});const data=await response.json();if(!response.ok)throw new Error(data.error??"تعذّر إنشاء المباراة");router.push("/survey-show/host/"+data.id);}catch(cause){setError(String(cause));setBusy(false);}}
  return <form className="panel social-form" onSubmit={create}><h2>جهّز الفريقين</h2><p>خمسة أسئلة، مواجهة ثم ثلاث فرص واقتناص. الأوزان محتوى محرّر للعبة وليست نتائج استطلاع حقيقي.</p>{[0,1].map(i=><label key={i}>اسم الفريق {i===0?"أ · المرجاني":"ب · التركوازي"}<input required minLength={2} maxLength={60} value={names[i]} onChange={e=>setNames(current=>i===0?[e.target.value,current[1]]:[current[0],e.target.value])}/></label>)}<p>تُخصم لعبة واحدة عند البدء. الإعادة داخل الجلسة مجانية.</p>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy?"جارٍ التجهيز…":<CreateCopy previous="أنشئ المباراة"/>}</button></form>;
}
