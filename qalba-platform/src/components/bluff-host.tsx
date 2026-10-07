/* eslint-disable @next/next/no-img-element -- QR data URLs must remain unoptimized. */
"use client";
import { hostActionClass, RematchCopy } from "./cta-copy";
import {useState} from "react";
import type {BluffView} from "@/lib/games/bluff/service";
import type {HostAction} from "@/lib/games/bluff/module";
import {useBluffLive} from "./bluff-live";
import {BluffStage,BluffScores} from "./bluff-stage";
export function BluffHost({initial,joinQr}:{initial:BluffView;joinQr:string}){
 const {view,send,error,busy,connection,ready,remaining}=useBluffLive(initial,"host"),[link,setLink]=useState<{url:string;qr:string}|null>(null),[linkError,setLinkError]=useState(""),[reason,setReason]=useState("غير مناسب للعرض");
 const button=(type:HostAction["type"],label:string,disabled=false)=><button className={hostActionClass(type)} key={type} disabled={busy||!ready||disabled} onClick={()=>void send({type} as HostAction)}>{type === "REMATCH" ? <RematchCopy previous={label}/> : label}</button>;
 async function display(revoke=false){setLinkError("");try{const r=await fetch(`/api/bluff/${view.id}/display-access`,{method:revoke?"DELETE":"POST"}),d=await r.json();if(!r.ok)throw new Error(d.error);setLink(revoke?null:d);}catch(e){setLinkError(e instanceof Error?e.message:"تعذّر إنشاء الرابط");}}
 return <div className="shell bluff-host" data-phase={view.phase} data-live-ready={ready}><div className="page-title"><span className="eyebrow">وضع المضيف</span><h1>صدّقني</h1></div>{connection&&<p role="status">{connection}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
 <BluffStage view={view} remaining={remaining} joinQr={joinQr}/>
 {view.phase==="LOBBY"&&<section className="panel"><h2>اللاعبون · {view.participants.length}</h2>{view.participants.map(p=><div className="bluff-player-row" key={p.id}><span>{p.name}</span><button className="btn btn-secondary" disabled={busy||!ready} aria-label={`إزالة ${p.name}`} onClick={()=>void send({type:"REMOVE_PARTICIPANT",participantId:p.id})}>إزالة</button></div>)}</section>}
 <div className="host-controls bluff-controls">
 {view.phase==="LOBBY"&&button("START","ابدأ اللعبة",view.participants.length<3)}
 {view.phase==="ROUND_INTRO"&&button("START_ROUND","ابدأ الجولة")}
 {view.phase==="FAKE_SUBMISSION"&&!view.submissionsClosed&&button("CLOSE_SUBMISSIONS","أغلق الإجابات")}
 {view.phase==="FAKE_SUBMISSION"&&(view.submissionsClosed||view.submissionCount===view.participants.length)&&button("BEGIN_VOTING","ابدأ التصويت")}
 {view.phase==="VOTING"&&button("CLOSE_VOTING","اكشف الحقيقة",!view.canCloseVoting&&remaining>0)}
 {view.phase==="REVEAL"&&button("ADVANCE_REVEAL","نتائج الجولة")}
 {view.phase==="ROUND_RESULTS"&&button("NEXT_ROUND",view.roundNumber===view.roundCount?"النتيجة النهائية":"الجولة التالية")}
 {view.phase==="FINAL_RESULTS"&&button("COMPLETE","أكمل المباراة")}
 {view.phase==="COMPLETED"&&button("REMATCH","إعادة المباراة")}
 {view.phase==="PAUSED"?button("RESUME","استئناف"):["ROUND_INTRO","FAKE_SUBMISSION","VOTING","REVEAL","ROUND_RESULTS"].includes(view.phase)&&button("PAUSE","إيقاف مؤقت")}
 {view.canUndo&&button("UNDO","إعادة فتح الإجابات")}
 {!["LOBBY","FINAL_RESULTS","COMPLETED","ABANDONED"].includes(view.phase)&&button("END_GAME","إنهاء مبكر")}
 {!["COMPLETED","ABANDONED"].includes(view.phase)&&button("ABANDON","إلغاء المباراة")}
 </div>
 {view.moderationQueue&&view.moderationQueue.length>0&&<section className="panel"><h2>مراجعة قبل التصويت</h2><p>إخفاء الإجابة يمنع عرضها واحتساب نقاط تمويه لها. تبقى هويتها سرية حتى الكشف.</p><label>سبب الإخفاء<input value={reason} maxLength={200} onChange={e=>setReason(e.target.value)}/></label>{view.moderationQueue.map(a=><div className="bluff-player-row" key={a.id}><span>{a.text}</span><button className="btn btn-secondary" disabled={busy||!reason.trim()} onClick={()=>void send({type:"HIDE_ANSWER",answerId:a.id,reason})}>إخفاء الإجابة</button></div>)}</section>}
 {!view.winnerIds.length&&!["LOBBY","REVEAL","ROUND_RESULTS","FINAL_RESULTS","COMPLETED"].includes(view.phase)&&<BluffScores view={view}/>}
 <section className="panel display-link-panel"><h2>شاشة TV</h2><div className="utility-links"><button className="btn btn-secondary" onClick={()=>void display()}>إنشاء رابط العرض</button><button className="btn btn-secondary" onClick={()=>void display(true)}>إلغاء روابط العرض</button></div>{linkError&&<p role="alert">{linkError}</p>}{link&&<><a className="btn btn-secondary" href={link.url} target="_blank" rel="noreferrer">افتح شاشة العرض</a><button className="btn btn-secondary" onClick={()=>void navigator.clipboard.writeText(link.url)}>نسخ رابط العرض</button><img src={link.qr} alt="رمز شاشة العرض" width={180} height={180}/></>}</section>
 </div>;
}
