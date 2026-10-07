"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Flag = { key: string; enabled: boolean; config: unknown };
export function FeatureManager({ flags }: { flags: Flag[] }) {
  const router = useRouter(); const [selected, setSelected] = useState<Flag | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [version, setVersion] = useState(0);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError(""); setSuccess("");
    try {
      const config = JSON.parse(String(data.get("config")));
      if (!config || Array.isArray(config) || typeof config !== "object") throw new Error("الإعدادات يجب أن تكون JSON object");
      const response = await fetch("/api/admin/features", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: data.get("key"), enabled: data.get("enabled") === "on", config }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "تعذّر الحفظ");
      setSuccess("حُفظ مفتاح الميزة"); setSelected(null); setVersion(value => value + 1); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الحفظ"); }
    finally { setBusy(false); }
  }
  return <div className="admin-layout"><section className="panel"><h2>{selected ? "تعديل مفتاح" : "مفتاح جديد"}</h2><form key={`${selected?.key ?? "new"}-${version}`} onSubmit={save}><div className="field"><label htmlFor="flag-key">المفتاح</label><input className="input" id="flag-key" name="key" dir="ltr" pattern="[a-z0-9-]{3,100}" readOnly={Boolean(selected)} defaultValue={selected?.key ?? ""} required /></div><div className="field"><label htmlFor="flag-config">إعدادات JSON</label><textarea className="input" id="flag-config" name="config" dir="ltr" maxLength={4000} defaultValue={selected ? JSON.stringify(selected.config, null, 2) : "{}"} required /></div><label className="check-field"><input type="checkbox" name="enabled" defaultChecked={selected?.enabled ?? false} /> مفعّل</label><div className="utility-links"><button className="btn btn-primary" disabled={busy}>حفظ</button>{selected && <button className="btn btn-secondary" type="button" onClick={() => setSelected(null)}>إلغاء</button>}</div></form>{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}</section><div className="item-list">{flags.map(flag => <div className="item" key={flag.key}><div><h3 dir="ltr">{flag.key}</h3><p>{flag.enabled ? "مفعّل" : "معطّل"}</p></div><button className="btn btn-secondary btn-small" onClick={() => setSelected(flag)}>تعديل</button></div>)}{flags.length === 0 && <div className="empty">لا توجد مفاتيح إضافية.</div>}</div></div>;
}
