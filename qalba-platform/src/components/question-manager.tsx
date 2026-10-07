"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; title: string };
type Question = {
  id: string; gameTypeId: string; categoryId: string; categoryTitle: string; question: string; answer: string;
  alternativeAnswers: string[]; explanation: string | null; difficulty: "EASY" | "MEDIUM" | "HARD";
  pointValue: number; type: "TEXT" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "IMAGE" | "AUDIO" | "RANKING" | "SURVEY" | "LETTER" | "PASSWORD";
  options: string[]; source: string | null; status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  subcategory: string | null; imageUrl: string | null; language: string; country: string | null;
};

export function QuestionManager({ categories, gameTypes, initial }: { categories: Option[]; gameTypes: Option[]; initial: Question[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Question | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const options = String(data.options || "").split("\n").map((value) => value.trim()).filter(Boolean);
    const alternativeAnswers = String(data.alternativeAnswers || "").split("\n").map((value) => value.trim()).filter(Boolean);
    const payload = {
      gameTypeId: String(data.gameTypeId), categoryId: String(data.categoryId), question: String(data.question), answer: String(data.answer),
      subcategory: data.subcategory || null, alternativeAnswers, explanation: data.explanation || null,
      difficulty: data.difficulty, pointValue: Number(data.pointValue), type: data.type,
      options: options.length ? options : null, imageUrl: data.imageUrl || null,
      source: data.source || null, status: data.status, language: "ar", country: data.country || null,
    };
    try {
      const response = await fetch(selected ? `/api/admin/questions/${selected.id}` : "/api/admin/questions", {
        method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "تعذّر حفظ السؤال");
      setSelected(null); setVersion(version + 1); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الحفظ"); }
    finally { setBusy(false); }
  }

  async function archive(question: Question) {
    if (!window.confirm("إخفاء هذا السؤال من اللعب؟ يمكنك استعادته بالتعديل لاحقًا.")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/questions/${question.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("تعذّر أرشفة السؤال");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الأرشفة"); }
    finally { setBusy(false); }
  }

  return <div className="admin-layout"><div className="panel"><h2>{selected ? "تعديل السؤال" : "سؤال جديد"}</h2>
    {(!categories.length || !gameTypes.length) && <p className="form-error">أضف فئة ونوع لعبة قبل إضافة الأسئلة.</p>}
    <form key={`${selected?.id ?? "new"}-${version}`} onSubmit={submit}>
      <div className="field"><label htmlFor="categoryId">الفئة</label><select className="input" id="categoryId" name="categoryId" defaultValue={selected?.categoryId ?? categories[0]?.id} required>{categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></div>
      <div className="field"><label htmlFor="gameTypeId">اللعبة</label><select className="input" id="gameTypeId" name="gameTypeId" defaultValue={selected?.gameTypeId ?? gameTypes[0]?.id} required>{gameTypes.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}</select></div>
      <div className="field"><label htmlFor="question">نص السؤال</label><textarea className="input" id="question" name="question" defaultValue={selected?.question ?? ""} minLength={8} maxLength={2000} required /></div>
      <div className="field"><label htmlFor="answer">الإجابة</label><input className="input" id="answer" name="answer" defaultValue={selected?.answer ?? ""} required /></div>
      <div className="field"><label htmlFor="type">نوع السؤال</label><select className="input" id="type" name="type" defaultValue={selected?.type ?? "TEXT"}><option value="TEXT">نصي</option><option value="MULTIPLE_CHOICE">اختيارات</option><option value="TRUE_FALSE">صح أو خطأ</option><option value="IMAGE">صورة</option><option value="AUDIO">صوت</option><option value="RANKING">ترتيب</option><option value="SURVEY">استطلاع</option><option value="LETTER">حروف</option><option value="PASSWORD">كلمة سر</option></select></div>
      <div className="field"><label htmlFor="options">الاختيارات، كل خيار في سطر</label><textarea className="input" id="options" name="options" defaultValue={selected?.options.join("\n") ?? ""} /></div>
      <div className="field"><label htmlFor="alternativeAnswers">إجابات بديلة، كل إجابة في سطر</label><textarea className="input" id="alternativeAnswers" name="alternativeAnswers" defaultValue={selected?.alternativeAnswers.join("\n") ?? ""} /></div>
      <div className="form-row"><div className="field" style={{ flex: 1 }}><label htmlFor="difficulty">الصعوبة</label><select className="input" id="difficulty" name="difficulty" defaultValue={selected?.difficulty ?? "EASY"}><option value="EASY">سهل</option><option value="MEDIUM">متوسط</option><option value="HARD">صعب</option></select></div><div className="field" style={{ flex: 1 }}><label htmlFor="pointValue">النقاط</label><input className="input" id="pointValue" name="pointValue" type="number" min={1} max={10000} defaultValue={selected?.pointValue ?? 200} required /></div></div>
      <div className="field"><label htmlFor="status">الحالة</label><select className="input" id="status" name="status" defaultValue={selected?.status ?? "DRAFT"}><option value="DRAFT">مسودة</option><option value="PUBLISHED">منشور</option><option value="ARCHIVED">مؤرشف</option></select></div>
      <div className="field"><label htmlFor="explanation">شرح الإجابة</label><textarea className="input" id="explanation" name="explanation" defaultValue={selected?.explanation ?? ""} /></div>
      <div className="field"><label htmlFor="source">المصدر أو ملاحظة التحرير</label><input className="input" id="source" name="source" defaultValue={selected?.source ?? ""} /></div>
      <div className="field"><label htmlFor="subcategory">تصنيف فرعي</label><input className="input" id="subcategory" name="subcategory" defaultValue={selected?.subcategory ?? ""} /></div>
      <div className="field"><label htmlFor="imageUrl">رابط الصورة (اختياري)</label><input className="input" id="imageUrl" name="imageUrl" type="url" dir="ltr" defaultValue={selected?.imageUrl ?? ""} /></div>
      <div className="field"><label htmlFor="country">رمز الدولة (اختياري)</label><input className="input" id="country" name="country" dir="ltr" pattern="[A-Z]{2,3}" placeholder="SA" defaultValue={selected?.country ?? ""} /></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-row"><button className="btn btn-primary" disabled={busy || !categories.length || !gameTypes.length}>{busy ? "جارٍ الحفظ..." : "حفظ السؤال"}</button>{selected && <button className="btn btn-secondary" type="button" onClick={() => setSelected(null)}>إلغاء</button>}</div>
    </form>
  </div><div className="item-list">{initial.map((question) => <div className="item" key={question.id}><div><h3>{question.question}</h3><p>{question.categoryTitle} · {question.pointValue} نقطة · {question.status === "PUBLISHED" ? "منشور" : question.status === "DRAFT" ? "مسودة" : "مؤرشف"}</p></div><div className="item-actions"><button className="btn btn-secondary btn-small" onClick={() => { setSelected(question); window.scrollTo({ top: 0, behavior: "smooth" }); }}>تعديل</button>{question.status !== "ARCHIVED" && <button className="btn btn-danger btn-small" disabled={busy} onClick={() => archive(question)}>أرشفة</button>}</div></div>)}{initial.length === 0 && <div className="empty">ما فيه أسئلة في هذه الصفحة. أضف سؤالًا أصليًا من النموذج.</div>}</div></div>;
}
