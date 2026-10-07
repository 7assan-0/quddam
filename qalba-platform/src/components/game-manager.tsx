"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Power = { id: string; slug: string; title: string; enabled: boolean; initialCount: number; seconds: number };
type Game = { id: string; slug: string; title: string; enabled: boolean; sessions: number; questions: number; powers: Power[] };
export function GameManager({ games }: { games: Game[] }) {
  const router = useRouter(); const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  async function save(path: string, payload: object, key: string) {
    setBusy(key); setError(""); setSuccess("");
    try {
      const response = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "تعذّر الحفظ");
      setSuccess("حُفظ الإعداد"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الحفظ"); }
    finally { setBusy(""); }
  }
  function savePower(event: FormEvent<HTMLFormElement>, power: Power) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void save(`/api/admin/powers/${power.id}`, { enabled: data.get("enabled") === "on", initialCount: Number(data.get("initialCount")),
      ...(power.slug === "extra-time" ? { seconds: Number(data.get("seconds")) } : {}) }, power.id);
  }
  return <div className="history-list">{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}
    {games.map(game => <section className="panel" key={game.id}><div className="history-row"><div><h2>{game.title}</h2><p className="muted">{game.sessions} مباراة · {game.questions} سؤال · {game.enabled ? "متاحة" : "متوقفة"}</p></div>
      <button className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => save(`/api/admin/games/${game.id}`, { enabled: !game.enabled }, game.id)}>{game.enabled ? "إيقاف استقبال مباريات جديدة" : "تفعيل اللعبة"}</button></div>
      {game.powers.length > 0 && <div className="admin-power-grid">{game.powers.map(power => <form className="info-card" key={power.id} onSubmit={event => savePower(event, power)}><h3>{power.title}</h3><label className="check-field"><input type="checkbox" name="enabled" defaultChecked={power.enabled} /> مفعلة</label><div className="field"><label htmlFor={`count-${power.id}`}>عدد الاستخدامات لكل فريق</label><input className="input" id={`count-${power.id}`} name="initialCount" type="number" min="0" max="10" defaultValue={power.initialCount} required /></div>
        {power.slug === "extra-time" && <div className="field"><label htmlFor={`seconds-${power.id}`}>ثواني إضافية</label><input className="input" id={`seconds-${power.id}`} name="seconds" type="number" min="1" max="120" defaultValue={power.seconds} required /></div>}
        <button className="btn btn-secondary btn-small" disabled={Boolean(busy)}>{busy === power.id ? "جارٍ الحفظ..." : "حفظ القدرة"}</button></form>)}</div>}
    </section>)}</div>;
}
