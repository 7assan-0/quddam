"use client";
import { useState } from "react";
type Word = { id: string; word: string; categoryId: string; category: string; difficulty: "EASY" | "MEDIUM" | "HARD"; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; alternativeAnswers: string[] };
export function SecretWordManager({ initial, categories }: { initial: Word[]; categories: { id: string; title: string }[] }) {
  const [words, setWords] = useState(initial); const [selected, setSelected] = useState<string | null>(null);
  const [word, setWord] = useState(""); const [categoryId, setCategory] = useState(categories[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState<Word["difficulty"]>("EASY"); const [status, setStatus] = useState<Word["status"]>("PUBLISHED");
  const [alternatives, setAlternatives] = useState(""); const [error, setError] = useState("");
  function edit(item: Word) { setSelected(item.id); setWord(item.word); setCategory(item.categoryId); setDifficulty(item.difficulty); setStatus(item.status); setAlternatives(item.alternativeAnswers.join("، ")); }
  function clear() { setSelected(null); setWord(""); setAlternatives(""); setStatus("PUBLISHED"); }
  async function save(event: React.FormEvent) { event.preventDefault(); setError("");
    const response = await fetch(selected ? `/api/admin/secret-words/${selected}` : "/api/admin/secret-words", { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, categoryId, difficulty, status, alternativeAnswers: alternatives.split(/[،,]/).map(s => s.trim()).filter(Boolean) }) });
    const data = await response.json(); if (!response.ok) return setError(data.error ?? "تعذّر الحفظ");
    const item: Word = { id: data.id, word: data.word, categoryId: data.categoryId, category: categories.find(c => c.id === data.categoryId)?.title ?? "", difficulty: data.difficulty, status: data.status, alternativeAnswers: data.alternativeAnswers };
    setWords(current => selected ? current.map(w => w.id === selected ? item : w) : [item, ...current]); clear();
  }
  async function archive(id: string) { const response = await fetch(`/api/admin/secret-words/${id}`, { method: "DELETE" });
    if (response.ok) setWords(items => items.map(item => item.id === id ? { ...item, status: "ARCHIVED" } : item)); else setError("تعذّرت الأرشفة"); }
  return <><form className="panel social-form" onSubmit={save}><h2>{selected ? "تعديل الكلمة" : "إضافة كلمة"}</h2>
    <label>الكلمة<input value={word} minLength={2} maxLength={100} onChange={e => setWord(e.target.value)} required /></label>
    <label>الفئة<select value={categoryId} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
    <label>الصعوبة<select value={difficulty} onChange={e => setDifficulty(e.target.value as Word["difficulty"])}><option value="EASY">سهلة</option><option value="MEDIUM">متوسطة</option><option value="HARD">صعبة</option></select></label>
    <label>الحالة<select value={status} onChange={e => setStatus(e.target.value as Word["status"])}><option value="PUBLISHED">منشورة</option><option value="DRAFT">مسودة</option><option value="ARCHIVED">مؤرشفة</option></select></label>
    <label>إجابات بديلة مفصولة بفاصلة<input value={alternatives} onChange={e => setAlternatives(e.target.value)} /></label>
    {error && <p role="alert" className="form-error">{error}</p>}<div className="host-actions"><button className="btn btn-primary">حفظ</button>{selected && <button className="btn btn-secondary" type="button" onClick={clear}>إلغاء التعديل</button>}</div></form>
    <div className="panel"><h2>الكلمات</h2><div className="social-list">{words.map(item => <div className="social-list-item" key={item.id}><span>{item.word} · {item.category} · {item.difficulty} · {item.status}</span><span className="host-actions"><button className="btn btn-secondary btn-small" onClick={() => edit(item)}>تعديل</button>{item.status !== "ARCHIVED" && <button className="btn btn-outline btn-small" onClick={() => archive(item.id)}>أرشفة</button>}</span></div>)}</div></div></>;
}
