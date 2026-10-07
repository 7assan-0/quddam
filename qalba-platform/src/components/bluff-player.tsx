"use client";
import {useState,useEffect,useRef} from "react";
import type {BluffView} from "@/lib/games/bluff/service";
import type {Action} from "@/lib/games/bluff/module";
import {useBluffLive} from "./bluff-live";
import {BluffStage,BluffTimer} from "./bluff-stage";
function PrivateInput({view,busy,send}:{view:BluffView;busy:boolean;send:(action:Action)=>Promise<boolean>}){
 const [text,setText]=useState(""),input=useRef<HTMLInputElement>(null),submit=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const viewport=window.visualViewport;let frame=0;const fit=()=>{if(document.activeElement!==input.current||(viewport?.height??window.innerHeight)>500)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{submit.current?.scrollIntoView({block:"nearest",behavior:"instant"});input.current?.scrollIntoView({block:"nearest",behavior:"instant"});});};viewport?.addEventListener("resize",fit);window.addEventListener("resize",fit);return()=>{viewport?.removeEventListener("resize",fit);window.removeEventListener("resize",fit);cancelAnimationFrame(frame);};},[]);
 return <form className="panel bluff-input" onSubmit={event=>{event.preventDefault();void send({type:"SUBMIT_FAKE",text,roundId:view.roundId!});}}><label htmlFor="bluff-fake">إجابتك المموّهة</label><input ref={input} id="bluff-fake" value={text} onChange={e=>setText(e.target.value)} maxLength={160} required autoComplete="off" aria-describedby="bluff-input-help"/><p id="bluff-input-help">اكتب إجابة قصيرة ومقنعة · {text.length} / 160 حرفًا</p><button ref={submit} className="btn btn-primary" disabled={busy||!text.trim()}>أرسل الإجابة</button></form>;
}
export function BluffPlayer({initial}:{initial:BluffView}){
 const {view,send,error,busy,connection,ready,remaining}=useBluffLive(initial,"player"),self=view.self;
 const phase=view.phase==="PAUSED"?view.pausedPhase:view.phase;
 return <div className="shell bluff-phone" data-phase={view.phase} data-live-ready={ready}><div className="page-title"><span className="eyebrow">{self?.name} · {self?.score??0} نقطة</span><h1>صدّقني</h1></div>{connection&&<p role="status">{connection}</p>}{error&&<p role="alert" className="form-error">{error}</p>}
 {phase==="VOTING"?<><BluffTimer view={view} remaining={remaining}/><section className="panel bluff-question"><h2>{view.question}</h2><p>أي إجابة هي الحقيقة؟ لا يمكنك اختيار إجابتك.</p></section>{self?.voted?<p className="panel" role="status">تم تسجيل اختيارك</p>:<div className="bluff-vote-buttons" aria-label="اختر الحقيقة">{view.choices.map((c,i)=><button className="btn btn-secondary" key={c.id} disabled={busy||!ready||view.phase==="PAUSED"||c.id===self?.ownChoiceId} aria-label={`${c.text}${c.id===self?.ownChoiceId?" · إجابتك":""}`} onClick={()=>void send({type:"SUBMIT_VOTE",roundId:view.roundId!,choiceId:c.id})}><span>الخيار {i+1}</span><strong>{c.text}</strong>{c.id===self?.ownChoiceId&&<small>إجابتك</small>}</button>)}</div>}<p role="status">{view.voteCount} / {view.participants.length} صوتوا</p></>:<BluffStage view={view} remaining={remaining}/>}
 {phase==="FAKE_SUBMISSION"&&self&&(self.submitted?<section className="panel"><h2>{self.answerHidden?"تم إخفاء إجابتك من خيارات الجولة":"إجابتك جاهزة"}</h2>{self.fakeAnswer&&<p>{self.fakeAnswer}</p>}</section>:view.submissionsClosed?<p>انتهى استقبال الإجابات. انتظر التصويت.</p>:view.phase==="PAUSED"?<p>انتظر استئناف المباراة لإرسال إجابتك.</p>:<PrivateInput key={view.roundId} view={view} busy={busy||!ready} send={send}/>)}
 {view.reveal&&self&&<section className="panel" aria-label="نتيجتك في الجولة"><h2>نتيجتك</h2><p>إجابتك: {self.fakeAnswer??"لم ترسل إجابة في هذه الجولة"}</p>{view.reveal.scores.filter(s=>s.participantId===self.id).map(s=><p key={s.participantId}>الحقيقة {s.correctPoints} · التمويه {s.bluffPoints} · المجموع {s.total}</p>)}<p>من اخترت إجابتك: {view.reveal.choices.find(c=>c.ownerId===self.id)?.voterIds.map(id=>view.participants.find(p=>p.id===id)?.name).join("، ")||"لا أحد"}</p></section>}
 </div>;
}
