"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Preview = { code: string; status: string; teams: { id: string; name: string; color: string }[] };
export function RoomJoin() {
  const router = useRouter(); const search = useSearchParams();
  const [code, setCode] = useState(search.get("code")?.toUpperCase() ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [name, setName] = useState(""); const [teamId, setTeamId] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function lookup(value: string) {
    setBusy(true); setError(""); setPreview(null);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(value.trim().toUpperCase())}/preview`, { cache: "no-store" });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "الغرفة غير متاحة");
      setPreview(result); setCode(result.code); setTeamId(result.teams[0]?.id ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر العثور على الغرفة"); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const initial = search.get("code"); if (!initial) return;
    let cancelled = false;
    fetch(`/api/rooms/${encodeURIComponent(initial.trim().toUpperCase())}/preview`, { cache: "no-store" })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "الغرفة غير متاحة"); return result as Preview; })
      .then((result) => { if (!cancelled) { setPreview(result); setCode(result.code); setTeamId(result.teams[0]?.id ?? ""); } })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "تعذّر العثور على الغرفة"); });
    return () => { cancelled = true; };
  }, [search]);
  async function join(event: FormEvent) {
    event.preventDefault(); if (!preview) { await lookup(code); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/rooms/${preview.code}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, teamId }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "تعذّر الانضمام");
      router.push(`/rooms/${result.code}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الانضمام"); setBusy(false); }
  }
  return <form className="panel room-form" onSubmit={join}><label htmlFor="room-code">رمز الغرفة</label><input id="room-code" className="input" dir="ltr" autoComplete="off" maxLength={6} value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setPreview(null); }} required />
    {preview && <><p>الغرفة جاهزة. اختر فريقك واسمك.</p><label htmlFor="guest-name">اسمك في اللعب</label><input className="input" id="guest-name" maxLength={60} minLength={2} required value={name} onChange={(event) => setName(event.target.value)} />
      <label htmlFor="guest-team">فريقك</label><select className="input" id="guest-team" value={teamId} onChange={(event) => setTeamId(event.target.value)}>{preview.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="btn btn-primary" disabled={busy}>{busy ? "جارٍ التحميل..." : preview ? "انضم إلى الغرفة" : "ابحث عن الغرفة"}</button></form>;
}
