"use client";
import { CreateCopy } from "./cta-copy";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SocialSetup() {
  const router = useRouter(); const [timer, setTimer] = useState(30); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function create(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError("");
    try { const response = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timerSeconds: timer }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "تعذّر إنشاء الغرفة"); router.push(`/social/host/${data.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر إنشاء الغرفة"); setBusy(false); } }
  return <form className="panel social-form" onSubmit={create}><h2>جهّز الغرفة</h2><p>٣ إلى ١٢ لاعبًا، والأفضل ٤ إلى ١٠. كل لاعب يفتح الرابط من جواله ويختار اسمه.</p>
    <label>مدة دور اللاعب<select value={timer} onChange={e => setTimer(Number(e.target.value))}><option value="20">٢٠ ثانية</option><option value="30">٣٠ ثانية</option><option value="45">٤٥ ثانية</option><option value="60">٦٠ ثانية</option></select></label>
    {error && <p role="alert" className="form-error">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? "جارٍ التجهيز…" : <CreateCopy previous="أنشئ الغرفة"/>}</button></form>;
}
