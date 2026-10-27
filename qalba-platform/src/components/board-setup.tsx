"use client";
import { formatNumber } from "@/lib/format-number";
import { CreateCopy } from "./cta-copy";
import { InfoTip } from "./info-tip";
import { categoryExplanation } from "@/lib/brand/explainers";
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
        body: JSON.stringify({ categoryIds: selected, teamNames: [form.get("teamA"), form.get("teamB")], timerSeconds: 60 }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "تعذّر إنشاء المباراة");
      router.push(`/play/${result.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر إنشاء المباراة"); setBusy(false); }
  }
  return <form onSubmit={submit} className="board-setup">
    <section className="panel"><span className="eyebrow">{formatNumber(1)} / الفئات</span><h2>ست فئات، ستة أسئلة لكل فئة</h2>
      <p className="muted">تظهر الفئات التي تضم سؤالين مختلفين ومنشورين على الأقل من كل مستوى ({formatNumber(200)}، {formatNumber(400)}، {formatNumber(600)}). المباراة فيها {formatNumber(36)} سؤالًا.</p>
      <div className="category-picker">{categories.map((category) => <div key={category.id} className={"category-choice" + (selected.includes(category.id) ? " selected" : "")}>
        <label className="category-option"><input type="checkbox" checked={selected.includes(category.id)}
          disabled={busy || (!selected.includes(category.id) && selected.length >= 6)}
          onChange={() => setSelected((previous) => previous.includes(category.id) ? previous.filter((id) => id !== category.id) : [...previous, category.id])}/>
          <span>{category.title}</span></label>
        <InfoTip title={category.title} {...categoryExplanation(category.title)}/>
      </div>)}</div>
      <p className="form-note">{formatNumber(selected.length)} من {formatNumber(6)} فئات مختارة</p>
      {categories.length < 6 && <p className="form-error">يلزم سؤالان على الأقل من كل مستوى في ست فئات. أضف المحتوى الناقص من لوحة الإدارة.</p>}
    </section>
    <section className="panel"><span className="eyebrow">{formatNumber(2)} / الفرق</span><h2>سمّوا الفريقين</h2>
      <div className="setup-fields"><div className="field"><label htmlFor="teamA">الفريق الأول</label><input className="input" id="teamA" name="teamA" minLength={2} maxLength={60} required defaultValue={defaults?.teamNames[0] ?? "فريق البرق"} /></div>
        <div className="field"><label htmlFor="teamB">الفريق الثاني</label><input className="input" id="teamB" name="teamB" minLength={2} maxLength={60} required defaultValue={defaults?.teamNames[1] ?? "فريق الموج"} /></div>
        <div className="field"><span className="field-label">وقت السؤال</span><p className="board-timer-fixed" role="note"><strong>{formatNumber(60)} ثانية</strong><span>وقت موحّد لكل سؤال في لوحة التحدّي</span></p></div></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary" aria-describedby="board-create-help" disabled={busy || selected.length !== 6 || categories.length < 6}>{busy ? "جارٍ إنشاء المباراة..." : <CreateCopy previous="جهّز اللوحة"/>}</button><p id="board-create-help" className="form-note" role="status">{selected.length !== 6 ? `اختاروا ${formatNumber(6)} فئات` : categories.length < 6 ? "المحتوى المنشور لا يكفي لإنشاء اللوحة بعد" : ""}</p>
    </section>
  </form>;
}
