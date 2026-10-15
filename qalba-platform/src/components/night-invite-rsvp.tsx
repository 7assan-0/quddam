"use client";

import { useEffect, useRef, useState } from "react";

type Invitation = {
  scheduledAt: string; timezone: string; open: boolean; coming: number; declined: number;
  games: { game: "top-list" | "ordering-challenge" | "survey-show"; title: string; votes: number }[];
  mine: { name: string; rsvp: "YES" | "NO"; gameVote: string | null } | null;
};
type Reply = { name: string; rsvp: "YES" | "NO"; gameVote: string | null };
export function NightInviteRsvp({ code }: { code: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [name, setName] = useState("");
  const [rsvp, setRsvp] = useState<"YES" | "NO">("YES");
  const [vote, setVote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const pendingReply = useRef<Reply | null>(null);
  const submitting = useRef(false);
  const initialRead = useRef<{ code: string; promise: Promise<Invitation> } | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    // StrictMode replays an effect during the first mount. Share that initial
    // request so it cannot mint two competing first-visit capability cookies.
    if (initialRead.current?.code !== code) {
      initialRead.current = { code, promise: fetch(`/api/night/invite/${encodeURIComponent(code)}`,
        { cache: "no-store", credentials: "same-origin" })
        .then(async response => {
          if (!response.ok) throw new Error("هذه الدعوة غير متاحة.");
          return (await response.json()).invitation as Invitation;
        }) };
    }
    void initialRead.current.promise.then(next => {
        if (!active) return;
        setInvitation(next);
        if (next.mine) { setName(next.mine.name); setRsvp(next.mine.rsvp); setVote(next.mine.gameVote); }
      }).catch(() => { if (active) setError("تعذر فتح الدعوة أو انتهت صلاحيتها."); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [code]);
  async function submit() {
    if (!invitation?.open || submitting.current) return;
    // A failed connection can hide a committed response. Keep the same reply
    // and preissued HttpOnly capability until its outcome is known.
    const input = pendingReply.current ?? { name, rsvp, gameVote: rsvp === "YES" ? vote : null };
    pendingReply.current = input;
    submitting.current = true;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/night/invite/${encodeURIComponent(code)}`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (response.status >= 500) throw new Error("Uncertain reply outcome");
      const data = await response.json();
      if (!response.ok) {
        pendingReply.current = null; setRetryPending(false);
        setError(data.error ?? "تعذر إرسال الرد."); return;
      }
      setInvitation(data.invitation);
      setName(data.invitation.mine?.name ?? input.name);
      setRsvp(data.invitation.mine?.rsvp ?? input.rsvp);
      setVote(data.invitation.mine?.gameVote ?? null);
      pendingReply.current = null; setRetryPending(false);
    } catch {
      setRetryPending(true);
      setError("تعذر تأكيد الحفظ. أعد المحاولة بالرد نفسه؛ سيبقى اسمك واختيارك محفوظين حتى نتحقق من النتيجة، دون إضافة حاضر آخر.");
    }
    finally { submitting.current = false; setBusy(false); }
  }
  return <div className="shell" data-testid="night-public-invitation" style={{ maxWidth: 750 }}>
    <div className="page-title"><span className="eyebrow">دعوة خاصة · ليلة قدّام</span><h1>سهرتنا قدّام</h1>
      <p>جاوب على الدعوة وصوّت للعبة اللي متحمس لها. دخول اللعب لاحقًا يكون برابط غرفة مستقل. التصويت يُظهر تفضيل الشلة ولا يغيّر ترتيب الألعاب المحفوظ تلقائيًا.</p></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!loaded && <p role="status">جارٍ تحميل الدعوة…</p>}
    {invitation && <section className="panel">
      <h2>موعد السهرة</h2>
      <p><strong>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "full", timeStyle: "short",
        timeZone: invitation.timezone }).format(new Date(invitation.scheduledAt))}</strong></p>
      <p>جاي: {invitation.coming} · مو جاي: {invitation.declined}</p>
      <h3>تصويت الألعاب</h3>
      <ul>{invitation.games.map(game => <li key={game.game}>{game.title}: {game.votes} صوت</li>)}</ul>
      {invitation.mine && <p role="status">ردّك المحفوظ: {invitation.mine.name} · {invitation.mine.rsvp === "YES" ? "جاي" : "مو جاي"}</p>}
      {!invitation.open ? <p>انتهى استقبال الردود أو بدأت السهرة. التصويت الآن مغلق.</p> : <>
        <label htmlFor="rsvp-name">اسمك في الدعوة (بدون بيانات شخصية)</label>
        <input id="rsvp-name" className="form-input" autoComplete="off" maxLength={60}
          value={name} onChange={event => setName(event.target.value)} readOnly={Boolean(invitation.mine) || busy || retryPending} />
        <fieldset disabled={busy || retryPending} style={{ marginBlock: 16 }}>
          <legend>بتجي السهرة؟</legend>
          <label><input type="radio" name="rsvp" checked={rsvp === "YES"} onChange={() => setRsvp("YES")} /> جاي</label>{" "}
          <label><input type="radio" name="rsvp" checked={rsvp === "NO"} onChange={() => { setRsvp("NO"); setVote(null); }} /> مو جاي</label>
        </fieldset>
        {rsvp === "YES" && <fieldset disabled={busy || retryPending} style={{ marginBlock: 16 }}>
          <legend>اختر لعبة واحدة للتصويت (اختياري)</legend>
          <label><input type="radio" name="vote" checked={vote === null} onChange={() => setVote(null)} /> بدون تصويت</label>
          {invitation.games.map(game => <label key={game.game} style={{ display: "block" }}>
            <input type="radio" name="vote" checked={vote === game.game} onChange={() => setVote(game.game)} /> {game.title}
          </label>)}
        </fieldset>}
        <button className="btn btn-primary" data-testid="night-rsvp-submit" disabled={busy || name.trim().length < 2}
          onClick={() => void submit()}>{busy ? "جارٍ الحفظ…" : retryPending ? "إعادة تأكيد الرد المحفوظ" : invitation.mine ? "تحديث ردي وتصويتي" : "تأكيد ردي"}</button>
        <p className="form-note">يحفظ الموقع رمزًا خاصًا في ملف تعريف ارتباط آمن للمتصفح حتى تقدر تعدّل ردّك. لا تُعرض أسماء الحضور لزوار الدعوة.</p>
      </>}
    </section>}
  </div>;
}
