"use client";
import { useState } from "react";
type Question={id:string;letter:string;question:string;answer:string;alternativeAnswers:string[];categoryId:string;category:string;difficulty:"EASY"|"MEDIUM"|"HARD";status:"DRAFT"|"PUBLISHED"|"ARCHIVED"};
export function LetterQuestionManager({initial,categories}:{initial:Question[];categories:{id:string;title:string}[]}){
  const [items,setItems]=useState(initial),[selected,setSelected]=useState<string|null>(null),[letter,setLetter]=useState("ا"),[question,setQuestion]=useState(""),[answer,setAnswer]=useState(""),[alternatives,setAlternatives]=useState("");
  const [categoryId,setCategory]=useState(categories[0]?.id??""),[difficulty,setDifficulty]=useState<Question["difficulty"]>("EASY"),[status,setStatus]=useState<Question["status"]>("PUBLISHED");
  const [q,setQ]=useState(""),[filterLetter,setFilter]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  function clear(){setSelected(null);setQuestion("");setAnswer("");setAlternatives("");setStatus("PUBLISHED");}
  function edit(item:Question){setSelected(item.id);setLetter(item.letter);setQuestion(item.question);setAnswer(item.answer);setAlternatives(item.alternativeAnswers.join("، "));setCategory(item.categoryId);setDifficulty(item.difficulty);setStatus(item.status);}
  function asItem(data:Omit<Question,"category">&{category:{title:string}|string}):Question{return {...data,category:typeof data.category==="string"?data.category:data.category.title};}
  async function save(event:React.FormEvent){event.preventDefault();setBusy(true);setError("");
    try{const response=await fetch("/api/admin/letter-questions"+(selected?"/"+selected:""),{method:selected?"PATCH":"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({letter,question,answer,alternativeAnswers:alternatives.split(/[،,]/).map(s=>s.trim()).filter(Boolean),categoryId,difficulty,status})});
      const data=await response.json();if(!response.ok)throw new Error(data.error??"تعذّر الحفظ");
      const item=asItem(data);setItems(current=>selected?current.map(i=>i.id===selected?item:i):[item,...current]);clear();
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذّر الحفظ");}finally{setBusy(false);}}
  async function search(event:React.FormEvent){event.preventDefault();setBusy(true);setError("");try{
    const response=await fetch("/api/admin/letter-questions?q="+encodeURIComponent(q)+"&letter="+encodeURIComponent(filterLetter));const data=await response.json();
    if(!response.ok)throw new Error(data.error);setItems(data.map(asItem));
  }catch(cause){setError(String(cause));}finally{setBusy(false);}}
  async function archive(id:string){setBusy(true);try{const response=await fetch("/api/admin/letter-questions/"+id,{method:"DELETE"});if(!response.ok)throw new Error("تعذّرت الأرشفة");setItems(current=>current.map(i=>i.id===id?{...i,status:"ARCHIVED"}:i));}catch(cause){setError(String(cause));}finally{setBusy(false);}}
  return <>{error&&<p role="alert" className="form-error">{error}</p>}<form className="panel social-form" onSubmit={save}><h2>{selected?"تعديل السؤال":"إضافة سؤال"}</h2>
    <label>الحرف<input value={letter} onChange={e=>setLetter(e.target.value)} required maxLength={4}/></label>
    <label>السؤال<textarea value={question} onChange={e=>setQuestion(e.target.value)} minLength={8} maxLength={2000} required/></label>
    <label>الإجابة<input value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={200} required/></label>
    <label>الإجابات البديلة، مفصولة بفاصلة<input value={alternatives} onChange={e=>setAlternatives(e.target.value)}/></label>
    <label>الفئة<select value={categoryId} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
    <label>الصعوبة<select value={difficulty} onChange={e=>setDifficulty(e.target.value as Question["difficulty"])}><option value="EASY">سهلة</option><option value="MEDIUM">متوسطة</option><option value="HARD">صعبة</option></select></label>
    <label>الحالة<select value={status} onChange={e=>setStatus(e.target.value as Question["status"])}><option value="PUBLISHED">منشورة</option><option value="DRAFT">مسودة</option><option value="ARCHIVED">مؤرشفة</option></select></label>
    <div className="host-actions"><button className="btn btn-primary" disabled={busy}>حفظ</button>{selected&&<button className="btn btn-outline" type="button" onClick={clear}>إلغاء التعديل</button>}</div>
  </form><form className="host-actions admin-search" onSubmit={search}><label>البحث<input value={q} onChange={e=>setQ(e.target.value)}/></label><label>تصفية بالحرف<input value={filterLetter} maxLength={4} onChange={e=>setFilter(e.target.value)}/></label><button className="btn btn-secondary" disabled={busy}>بحث</button></form>
    <section className="panel"><h2>الأسئلة · {items.length}</h2><div className="social-list">{items.map(item=><div className="social-list-item" key={item.id}><div><strong>{item.letter} · {item.question}</strong><p>{item.answer} · {item.category} · {item.difficulty} · {item.status}</p></div>
      <div className="host-actions"><button className="btn btn-secondary btn-small" disabled={busy} onClick={()=>edit(item)}>تعديل</button>{item.status!=="ARCHIVED"&&<button className="btn btn-outline btn-small" disabled={busy} onClick={()=>archive(item.id)}>أرشفة</button>}</div></div>)}</div></section></>;
}
