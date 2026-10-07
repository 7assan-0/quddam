"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
export function SocialJoin() {
  const router = useRouter(); const params = useSearchParams(); const [code, setCode] = useState(params.get("code")?.toUpperCase() ?? "");
  const [name, setName] = useState(""); const [id, setId] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (code.length !== 6) return; let active = true;
    fetch(`/api/social/preview/${encodeURIComponent(code)}`).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (active) { setId(data.id); setError(data.status === "LOBBY" ? "" : "بدأت الجولة، لا يمكن الانضمام الآن"); } })
      .catch(cause => { if (active) { setId(""); setError(cause instanceof Error ? cause.message : "الغرفة غير متاحة"); } });
    return () => { active = false; }; }, [code]);
  async function join(event: React.FormEvent) { event.preventDefault(); if (!id) return; setBusy(true); setError("");
    try { const response = await fetch(`/api/social/${id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "تعذّر الانضمام"); router.push(`/social/play/${data.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الانضمام"); setBusy(false); } }
  return <form className="panel social-form" onSubmit={join}><label>رمز الغرفة<input value={code} maxLength={6} onChange={e => setCode(e.target.value.toUpperCase())} required /></label>
    <label>اسمك في اللعبة<input value={name} minLength={2} maxLength={60} onChange={e => setName(e.target.value)} required /></label>
    {error && <p role="alert" className="form-error">{error}</p>}<button className="btn btn-primary" disabled={!id || busy}>{busy ? "جارٍ الدخول…" : "ادخل اللعبة"}</button></form>;
}
