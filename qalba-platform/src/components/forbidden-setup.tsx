"use client";
import { CreateCopy } from "./cta-copy";
import {useState} from "react";
import {useRouter} from "next/navigation";
export function ForbiddenSetup(){const router=useRouter(),[names,setNames]=useState<[string,string]>(["الفريق الأول","الفريق الثاني"]),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function create(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/secret-word",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({names})}),v=await r.json();if(!r.ok)throw new Error(v.error);router.push("/secret-word/host/"+v.id);}catch(cause){setError(String(cause));setBusy(false);}}
  return <form className="panel social-form" onSubmit={create}><h2>جهّز الفريقين</h2>{[0,1].map(i=><label key={i}>اسم الفريق {i===0?"أ · البرتقالي":"ب · السماوي"}<input required minLength={2} maxLength={60} value={names[i]} onChange={e=>setNames(current=>i===0?[e.target.value,current[1]]:[current[0],e.target.value])}/></label>)}<p>الصحيح +1، التجاوز 0، المخالفة −1. مجموع الفريق لا ينزل عن الصفر.</p><p>تُخصم لعبة واحدة عند البدء. الإعادة داخل الجلسة مجانية.</p>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy?"جارٍ التجهيز…":<CreateCopy previous="أنشئ المباراة"/>}</button></form>;
}
