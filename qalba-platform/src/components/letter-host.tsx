"use client";
import { RematchCopy } from "./cta-copy";
import Image from "next/image";
import { useState } from "react";
import type { LetterView } from "@/lib/games/letter-network/service";
import { useLetterLive } from "./letter-live";
import { LetterBoard,LetterTeams } from "./letter-board";
export function LetterHost({initial}:{initial:LetterView}){
  const {view,error,setError,busy,connection,seconds,send,hydrated}=useLetterLive(initial,"host");
  const [access,setAccess]=useState<{url:string;qrDataUrl:string;expiresAt:string}|null>(null),[accessBusy,setAccessBusy]=useState(false);
  async function openDisplay(){setAccessBusy(true);setError("");
    try{const response=await fetch("/api/letter-network/"+view.id+"/display-access",{method:"POST"}),data=await response.json();
      if(!response.ok)throw new Error(data.error??"تعذّر إنشاء رابط العرض");setAccess(data);
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذّر إنشاء رابط العرض");}finally{setAccessBusy(false);}}
  async function revoke(){setAccessBusy(true);try{const response=await fetch("/api/letter-network/"+view.id+"/display-access",{method:"DELETE"});if(!response.ok)throw new Error("تعذّر إلغاء الروابط");setAccess(null);}catch(cause){setError(String(cause));}finally{setAccessBusy(false);}}
  const team=view.teams.find(t=>t.id===view.answeringTeamId),winner=view.teams.find(t=>t.id===view.winnerTeamId);
  return <div className="shell letter-page" data-live-ready={hydrated} data-phase={view.phase} data-version={view.version}><div className="page-title"><span className="eyebrow">إدارة المباراة · الجولة {view.matchNumber||1}</span><h1>شبكة الحروف</h1><p>اختر حرفًا، اسأل الفريق، ثم احكم على الإجابة. أول مسار متصل يحسم المباراة.</p></div>
    {connection&&<p role="status" className="muted">{connection}</p>}{error&&<p role="alert" className="form-error">{error}</p>}
    <div className="host-actions"><button className="btn btn-secondary" disabled={accessBusy} onClick={openDisplay}>فتح شاشة العرض</button>
      <button className="btn btn-outline" disabled={accessBusy} onClick={revoke}>إلغاء روابط العرض</button></div>
    {access&&<div className="social-modal-backdrop"><div className="panel social-modal" role="dialog" aria-modal="true" aria-label="رابط شاشة العرض">
      <button className="btn btn-outline btn-small" onClick={()=>setAccess(null)}>إغلاق</button><h2>شاشة العرض</h2>
      <Image unoptimized src={access.qrDataUrl} alt="رمز QR لرابط شاشة العرض" width={220} height={220}/>
      <p>ينتهي الرابط: {new Date(access.expiresAt).toLocaleString("ar-SA")}</p><a className="btn btn-secondary" href={access.url} target="_blank" rel="noopener noreferrer">فتح العرض في هذا الجهاز</a>
      <button className="btn btn-primary" onClick={()=>navigator.clipboard.writeText(new URL(access.url,window.location.origin).href)}>نسخ رابط العرض</button></div></div>}
    <LetterTeams view={view}/>
    {view.phase==="LOBBY"&&<section className="panel"><h2>الفريقان جاهزان</h2><p>سيختار الخادم الحروف من الأسئلة المنشورة فقط.</p><button className="btn btn-primary" disabled={busy} onClick={()=>send({type:"START"})}>ابدأ اللعبة</button></section>}
    <div className="letter-layout">{view.board.length>0&&<LetterBoard view={view} disabled={busy} onSelect={cellId=>send({type:"SELECT_CELL",cellId})}/>}
      <section className="panel letter-stage" aria-live="polite">
        {view.phase==="READY"&&<><h2>الدور: {team?.name}</h2><p>اختر خلية متاحة من الشبكة.</p></>}
        {view.phase==="CELL_SELECTED"&&<><h2>الحرف: {view.board.find(c=>c.cellId===view.activeCellId)?.letter}</h2><p>السؤال جاهز. يبدأ المؤقت عند فتحه.</p><button className="btn btn-primary" disabled={busy} onClick={()=>send({type:"OPEN_QUESTION"})}>افتح السؤال</button></>}
        {view.question&&<><span className="eyebrow">{view.phase==="STEAL"?"فرصة الاقتناص":"السؤال"} · {team?.name}</span><h2>{view.question.text}</h2><p>الإجابة تبدأ بحرف {view.question.letter}</p>
          <p className="letter-timer" aria-label="الوقت المتبقي">{seconds} ث</p>
          {"answer" in view.question&&<p className="letter-private-answer">للمضيف فقط: {view.question.answer}{view.question.alternativeAnswers?.length?" · "+view.question.alternativeAnswers.join("، "):""}</p>}
          {["QUESTION_ACTIVE","STEAL"].includes(view.phase)&&<div className="host-actions">
            {!("answer" in view.question)&&<button className="btn btn-secondary" disabled={busy||seconds===0} onClick={()=>send({type:"REVEAL_ANSWER"})}>كشف الإجابة للمضيف</button>}
            <button className="btn btn-success" disabled={busy||seconds===0} onClick={()=>send({type:view.phase==="STEAL"?"STEAL_CORRECT":"CORRECT"})}>{view.phase==="STEAL"?"اقتناص صحيح":"إجابة صحيحة"}</button>
            <button className="btn btn-danger" disabled={busy||seconds===0} onClick={()=>send({type:view.phase==="STEAL"?"STEAL_WRONG":"WRONG"})}>{view.phase==="STEAL"?"اقتناص خاطئ":"إجابة خاطئة"}</button></div>}
        </>}
        {view.phase==="PAUSED"&&<><h2>توقف مؤقت</h2><p>السؤال والخلية والوقت محفوظة.</p></>}
        {view.lastAnswer&&<p className="muted">إجابة السؤال السابق: {view.lastAnswer.answer}</p>}
        {["RESULTS","COMPLETED"].includes(view.phase)&&<><h2>{winner?"فاز "+winner.name+"!":"انتهت المباراة دون فائز"}</h2>{winner&&<p>اكتمل المسار المتصل، وهو محدد على الشبكة.</p>}
          {view.phase==="RESULTS"?<button className="btn btn-primary" disabled={busy} onClick={()=>send({type:"COMPLETE"})}>ثبّت النتيجة</button>:<button className="btn btn-primary" disabled={busy} onClick={()=>send({type:"REMATCH"})}><RematchCopy previous="إعادة المباراة بنفس الفريقين"/></button>}</>}
        {view.phase==="ABANDONED"&&<h2>أُلغيت المباراة</h2>}
      </section>
    </div>
    <div className="host-actions letter-controls">
      {["READY","CELL_SELECTED","QUESTION_ACTIVE","STEAL"].includes(view.phase)&&<button className="btn btn-secondary" disabled={busy} onClick={()=>send({type:"PAUSE"})}>إيقاف مؤقت</button>}
      {view.phase==="PAUSED"&&<button className="btn btn-primary" disabled={busy} onClick={()=>send({type:"RESUME"})}>استئناف</button>}
      {view.canUndo&&<button className="btn btn-outline" disabled={busy} onClick={()=>send({type:"UNDO"})}>تراجع عن آخر حكم</button>}
      {["READY","CELL_SELECTED","QUESTION_ACTIVE","STEAL","PAUSED"].includes(view.phase)&&<button className="btn btn-outline" disabled={busy} onClick={()=>{if(window.confirm("إنهاء المباراة دون فائز؟"))send({type:"END_GAME"});}}>إنهاء المباراة</button>}
      {!["COMPLETED","ABANDONED"].includes(view.phase)&&<button className="btn btn-danger" disabled={busy} onClick={()=>{if(window.confirm("إلغاء المباراة؟"))send({type:"ABANDON"});}}>إلغاء المباراة</button>}
    </div>
  </div>;
}
