"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; slug: string; title: string; description: string | null; active: boolean; questions: number };

export function CategoryManager({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Category | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(selected ? `/api/admin/categories/${selected.id}` : "/api/admin/categories", {
        method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: data.slug, title: data.title, description: data.description || null, active: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "تعذّر الحفظ. تأكد من تفرّد الرمز.");
      setSelected(null); setVersion(version + 1); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الحفظ"); }
    finally { setBusy(false); }
  }

  async function toggle(category: Category) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !category.active }) });
      if (!response.ok) throw new Error("تعذّر تحديث الفئة");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر التحديث"); }
    finally { setBusy(false); }
  }

  return <div className="admin-layout"><div className="panel"><h2>{selected ? "تعديل الفئة" : "فئة جديدة"}</h2><form key={`${selected?.id ?? "new"}-${version}`} onSubmit={submit}>
    <div className="field"><label htmlFor="title">اسم الفئة</label><input className="input" id="title" name="title" defaultValue={selected?.title ?? ""} minLength={2} maxLength={100} required /></div>
    <div className="field"><label htmlFor="slug">رمز إنجليزي فريد</label><input className="input" id="slug" name="slug" defaultValue={selected?.slug ?? ""} pattern="[a-z0-9-]{2,100}" dir="ltr" placeholder="new-category" required /></div>
    <div className="field"><label htmlFor="description">وصف اختياري</label><textarea className="input" id="description" name="description" defaultValue={selected?.description ?? ""} maxLength={300} /></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-row"><button className="btn btn-primary" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ الفئة"}</button>{selected && <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>إلغاء</button>}</div>
  </form></div><div className="item-list">{initial.map((category) => <div className="item" key={category.id}><div><h3>{category.title}</h3><p>{category.slug} · {category.questions} سؤال · {category.active ? "ظاهرة" : "مخفية"}</p></div><div className="item-actions"><button className="btn btn-secondary btn-small" onClick={() => setSelected(category)}>تعديل</button><button className="btn btn-secondary btn-small" disabled={busy} onClick={() => toggle(category)}>{category.active ? "إخفاء" : "إظهار"}</button></div></div>)}{initial.length === 0 && <div className="empty">لا توجد فئات. أضف أول فئة من النموذج.</div>}</div></div>;
}
