"use client";
import { CreateCopy } from "./cta-copy";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; title: string };
export function BoardSetup({ categories, defaults }: { categories: Category[]; defaults?: { categoryIds: string[]; teamNames: string[] } }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(defaults?.categoryIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.length !== 6) { setError("اختر ست فئات بالضبط"); return; }
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/games/category-board", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds: selected, teamNames: [form.get("teamA"), form.get("teamB")], timerSeconds: Number(form.get("timer")) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "تعذّر إنشاء المباراة");
      router.push(`/play/${result.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر إنشاء المباراة"); setBusy(false); }
  }
  return <form onSubmit={submit} className="board-setup">
    <section className="panel"><span className="eyebrow">١ / الفئات</span><h2>ست فئات، ثلاث قيم لكل فئة</h2>
      <p className="muted">تظهر هنا الفئات التي تضم أسئلة منشورة بقيم ٢٠٠ و٤٠٠ و٦٠٠.</p>
      <div className="category-picker">{categories.map((category) => <label key={category.id} className={`category-option ${selected.includes(category.id) ? "selected" : ""}`}>
        <input type="checkbox" checked={selected.includes(category.id)} disabled={busy || (!selected.includes(category.id) && selected.length >= 6)}
          onChange={() => setSelected((old) => old.includes(category.id) ? old.filter((id) => id !== category.id) : [...old, category.id])} />
        <span>{category.title}</span></label>)}</div>
      <p className="form-note">{selected.length} من ٦ فئات مختارة</p>
      {categories.length < 6 && <p className="form-error">يلزم نشر ثلاث قيم في ست فئات على الأقل. أضف أسئلة من لوحة الإدارة.</p>}
    </section>
    <section className="panel"><span className="eyebrow">٢ / الفرق</span><h2>سمّوا الفريقين</h2>
      <div className="setup-fields"><div className="field"><label htmlFor="teamA">الفريق الأول</label><input className="input" id="teamA" name="teamA" minLength={2} maxLength={60} required defaultValue={defaults?.teamNames[0] ?? "فريق البرق"} /></div>
        <div className="field"><label htmlFor="teamB">الفريق الثاني</label><input className="input" id="teamB" name="teamB" minLength={2} maxLength={60} required defaultValue={defaults?.teamNames[1] ?? "فريق الموج"} /></div>
        <div className="field"><label htmlFor="timer">ثواني السؤال</label><select className="input" id="timer" name="timer" defaultValue="30"><option value="20">٢٠ ثانية</option><option value="30">٣٠ ثانية</option><option value="45">٤٥ ثانية</option><option value="60">٦٠ ثانية</option></select></div></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy || selected.length !== 6 || categories.length < 6}>{busy ? "جارٍ إنشاء المباراة..." : <CreateCopy previous="جهّز اللوحة"/>}</button>
    </section>
  </form>;
}
