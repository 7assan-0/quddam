"use client";
import Link from "next/link";
import { useState } from "react";
type Entry = { id: string; name: string; status: string; role: string; members: number; nights: number };
export function ShillatakHome({ initial }: { initial: Entry[] }) {
  const [groups, setGroups] = useState(initial);
  const [name, setName] = useState(""), [teamA, setTeamA] = useState(""), [teamB, setTeamB] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/shillatak", { method: "POST", credentials: "same-origin",
        cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, teams: [teamA, teamB] }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "تعذر إنشاء الشلّة"); return; }
      const group = data.shilla;
      setGroups(old => [{ id: group.id, name: group.name, status: group.status,
        role: "OWNER", members: 1, nights: 0 }, ...old]);
      setName(""); setTeamA(""); setTeamB("");
    } catch { setError("تعذر الاتصال، حدّث الصفحة قبل إعادة الطلب."); }
    finally { setBusy(false); }
  }
  return <div className="shell" data-testid="shillatak-home">
    <div className="page-title"><span className="eyebrow">شِلّتك · دايمًا تتذكرون الفوز</span>
      <h1>شلّتك ولوحة الشرف</h1><p>مجموعة خاصة بحسابات قدّام المسجّلة، وفريقان ثابتان لربط سهرات ليلة قدّام المكتملة فقط.</p></div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <section className="panel"><h2>أنشئ شلّة</h2>
      <form onSubmit={event => void create(event)}>
        <label htmlFor="shilla-name">اسم الشلّة</label>
        <input className="form-input" id="shilla-name" maxLength={60} minLength={2} required value={name}
          onChange={event => setName(event.target.value)} />
        <label htmlFor="shilla-team-a">الفريق الأول (اسم ثابت)</label>
        <input className="form-input" id="shilla-team-a" maxLength={60} minLength={2} required value={teamA}
          onChange={event => setTeamA(event.target.value)} />
        <label htmlFor="shilla-team-b">الفريق الثاني (اسم ثابت)</label>
        <input className="form-input" id="shilla-team-b" maxLength={60} minLength={2} required value={teamB}
          onChange={event => setTeamB(event.target.value)} />
        <p className="form-note">اربط لاحقًا سهرات مكتملة بأسماء الفريقين نفسيهما. لا ننسب فوز الفريق تلقائيًا إلى عضو بعينه.</p>
        <button className="btn btn-primary" disabled={busy || !name.trim() || !teamA.trim() || !teamB.trim()}>
          {busy ? "جارٍ الإنشاء…" : "إنشاء الشلّة"}</button>
      </form>
    </section>
    <section className="panel" style={{ marginBlock: "1rem" }}><h2>شللك الخاصة</h2>
      {groups.length === 0 && <p>ما انضمّيت لأي شلّة حتى الآن.</p>}
      <div className="history-list">{groups.map(group => <article className="history-row" key={group.id}>
        <span><strong>{group.name}</strong> · {group.role === "OWNER" ? "المنظّم" : "عضو"} · {group.status === "archived" ? "مؤرشفة" : "نشطة"}<p>{group.members} أعضاء · {group.nights} سهرات مكتملة مسجلة</p></span>
        <Link className="btn btn-secondary" href={`/shillatak/${group.id}`}>لوحة الشرف</Link>
      </article>)}</div>
    </section>
    <div className="utility-links"><Link className="btn btn-outline" href="/night">ليلة قدّام</Link>
      <Link className="btn btn-secondary" href="/games">الألعاب</Link></div>
  </div>;
}
