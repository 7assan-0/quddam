"use client";
import { formatNumber } from "@/lib/format-number";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import type { getShillaView } from "@/lib/shillatak/service";
type View = Awaited<ReturnType<typeof getShillaView>>;
type Action = { op: "INVITE" } | { op: "ATTACH"; nightId: string } |
  { op: "ARCHIVE" } | { op: "LEAVE" } | { op: "REVOKE"; inviteId: string };
const subscribeTimeZone = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone = () => "UTC";
export function ShillatakGroup({ initial }: { initial: View }) {
  const router = useRouter();
  const [group, setGroup] = useState(initial), [inviteLink, setInviteLink] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const inFlight = useRef(false);
  // The first client render must agree with SSR even when their time zones differ.
  const displayTimeZone = useSyncExternalStore(subscribeTimeZone, browserTimeZone, serverTimeZone);
  const endpoint = `/api/shillatak/${encodeURIComponent(group.id)}`;
  async function readCurrent() {
    const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error("SHILLA_REFRESH_FAILED");
    return (await response.json()).shilla as View;
  }
  async function command(action: Action) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    if (action.op === "REVOKE" || action.op === "ARCHIVE") setInviteLink("");
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "تعذر تنفيذ الإجراء. اقرأ الحالة قبل إعادة المحاولة."); return; }
      if (action.op === "INVITE") {
        setInviteLink(new URL(data.invitation.path, location.origin).href);
        setNotice("تم إنشاء رابط عضوية أحادي الاستخدام صالح لسبعة أيام. انسخه الآن؛ لا يُسترجع نصه لاحقًا.");
        // INVITE reveals its secret once. Refresh revocation metadata separately,
        // preserving that successful one-time response even if this read fails.
        try { setGroup(await readCurrent()); }
        catch { setError("أُنشئت الدعوة. احفظ الرابط ثم حدّث الشلّة لعرض قائمة الدعوات وإلغائها."); }
      } else if (action.op === "LEAVE") router.replace("/shillatak");
      else {
        setGroup(data.shilla);
        setConfirmArchive(false);
        setNotice(action.op === "ATTACH" ? "أُضيفت نتيجة السهرة المكتملة إلى لوحة الشرف." :
          action.op === "REVOKE" ? "أُلغيت الدعوة، ولم يعد رابطها صالحًا للانضمام." : "أُرشفت الشلّة ومنعت الدعوات والربط الجديد.");
      }
    } catch { setError("تعذر التأكد من نتيجة الأمر. حدّث بيانات الشلّة قبل إعادة الطلب؛ رابط الدعوة قد يكون أُنشئ بالفعل."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice(""); setInviteLink("");
    try {
      setGroup(await readCurrent());
      setNotice("تم تحديث النتائج والعضويات المحفوظة.");
    } catch { setError("تعذر تحديث الشلّة حاليًا."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="shell" data-testid="shillatak-group">
    <div className="page-title"><span className="eyebrow">مجموعة خاصة · للأعضاء فقط</span><h1>{group.name}</h1>
      <p>{group.status === "active" ? "شلّة نشطة" : "شلّة مؤرشفة للقراءة فقط"} · {formatNumber(group.members.length)} أعضاء · {formatNumber(group.nights.length)} سهرات مكتملة</p>
      <p className="form-note">توقيت عرض المواعيد: {displayTimeZone}</p>
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status" className="form-note">{notice}</p>}
    <div className="utility-links"><button className="btn btn-secondary" disabled={busy} onClick={() => void refresh()}>
      {busy ? "جارٍ العمل…" : "تحديث الشلّة"}</button><Link className="btn btn-outline" href="/shillatak">شللي الخاصة</Link></div>
    <section className="panel" style={{ marginBlock: "1rem" }} aria-labelledby="shilla-board-title">
      <span className="eyebrow">من نتائج ليلة قدّام المعتمدة فقط</span><h2 id="shilla-board-title">لوحة الشرف</h2>
      <table className="bluff-leaderboard" data-testid="shilla-leaderboard"><thead><tr>
        <th scope="col">المركز</th><th scope="col">الفريق الثابت</th><th scope="col">بطولات الليلة</th>
        <th scope="col">النقاط التراكمية</th><th scope="col">السهرات</th>
      </tr></thead><tbody>{group.leaderboard.map(team => <tr key={team.id}>
        <td>{formatNumber(team.rank)}</td><th scope="row">{team.name}</th><td>{formatNumber(team.wins)}</td><td>{formatNumber(team.points)}</td><td>{formatNumber(team.played)}</td>
      </tr>)}</tbody></table>
      <p className="form-note">كل فريق متعادل في المركز الأول يُحتسب له فوز في السهرة نفسها. هذه إحصاءات فرق وليست انتصارات شخصية لأعضاء الشلّة.</p>
    </section>
    <section className="panel" style={{ marginBlock: "1rem" }}><h2>سجل السهرات</h2>
      {group.nights.length === 0 && <p>لم تُربط سهرة مكتملة بهذه الشلّة بعد.</p>}
      <div className="history-list">{group.nights.map(night => <article key={night.id} className="history-row">
        <div><strong>سهرة {new Intl.DateTimeFormat("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: displayTimeZone }).format(new Date(night.recordedAt))}</strong>
          {night.teams.map(team => <p key={team.id}>{team.name}: {formatNumber(team.points)} نقاط {team.champion ? "· بطل الليلة" : ""}</p>)}</div>
      </article>)}</div>
    </section>
    <section className="panel" style={{ marginBlock: "1rem" }}><h2>أعضاء الشلّة</h2>
      <ul>{group.members.map(member => <li key={member.id}>{member.name} · {member.role === "OWNER" ? "المنظّم" : "عضو"}</li>)}</ul>
      <p className="form-note">العضوية اختيارية بحساب قدّام؛ تظهر أسماء الحسابات للأعضاء فقط. لا نربط أسماء الحضور المجهولة بهوية عضو.</p>
    </section>
    {group.owner && group.status === "active" && <section className="panel" style={{ marginBlock: "1rem" }}
      data-testid="shilla-owner-tools"><h2>أدوات منظّم الشلّة</h2>
      <h3>دعوة عضو مسجّل</h3><p>يسمح الرابط بانضمام حساب واحد، ويمكن لمن يحمله إعادة مشاركته. يُستخدم مرة واحدة، وإنشاء دعوة لا يُرسل رسالة آلية.</p>
      <button className="btn btn-secondary" disabled={busy} onClick={() => void command({ op: "INVITE" })}>إنشاء رابط عضوية</button>
      {inviteLink && <div><label htmlFor="shilla-new-link">احفظ الرابط الآن</label>
        <input className="input" id="shilla-new-link" dir="ltr" readOnly value={inviteLink} style={{ width: "100%" }}/>
        <button className="btn btn-secondary" onClick={() => void navigator.clipboard.writeText(inviteLink)
          .then(() => setNotice("تم نسخ رابط العضوية"), () => setError("انسخ الرابط يدويًا من الحقل."))}>نسخ الرابط</button></div>}
      <h3>الدعوات النشطة</h3>
      {group.activeInvites.length === 0 && <p>لا توجد روابط عضوية نشطة.</p>}
      {group.activeInvites.map(invite => <div className="history-row" key={invite.id}>
        <span>دعوة تنتهي {new Intl.DateTimeFormat("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: displayTimeZone }).format(new Date(invite.expiresAt))}</span>
        <button className="btn btn-danger" disabled={busy} onClick={() => void command({ op: "REVOKE", inviteId: invite.id })}>إلغاء الدعوة</button>
      </div>)}
      <h3>إضافة سهرة مكتملة إلى لوحة الشرف</h3>
      <p>نربط السهرة صراحةً إذا كنت مالكها، واكتملت ألعابها الثلاث، وطابق اسمَا الفريقين الفريقين الثابتين هنا. لا يُخصم رصيد عند الربط.</p>
      {group.eligibleNights.length === 0 && <p>لا توجد سهرات مؤهلة غير مرتبطة ضمن أحدث 20 سهرة.</p>}
      {group.eligibleNights.map(night => <div className="history-row" key={night.id}>
        <span>سهرة مكتملة · {new Intl.DateTimeFormat("ar-SA-u-nu-latn", { dateStyle: "medium", timeZone: displayTimeZone }).format(new Date(night.createdAt))}</span>
        <button className="btn btn-primary" disabled={busy} onClick={() => void command({ op: "ATTACH", nightId: night.id })}>سجّل النتيجة</button>
      </div>)}
      <h3>أرشفة الشلّة</h3><p>توقف الدعوات وربط السهرات، وتحفظ السجل للقراءة. ليست حذفًا للبيانات.</p>
      {!confirmArchive ? <button className="btn btn-danger" disabled={busy} onClick={() => setConfirmArchive(true)}>أرشفة الشلّة</button>
        : <div className="utility-links"><button className="btn btn-danger" disabled={busy} onClick={() => void command({ op: "ARCHIVE" })}>تأكيد الأرشفة</button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => setConfirmArchive(false)}>إلغاء</button></div>}
    </section>}
    {!group.owner && <section className="panel" style={{ marginBlock: "1rem" }}><h2>العضوية</h2>
      <p>إذا غادرت، لن يظهر اسمك في قائمة الأعضاء بعد الآن؛ يظل تاريخ نتائج الفرق غير شخصي كما هو.</p>
      <button className="btn btn-danger" disabled={busy} onClick={() => void command({ op: "LEAVE" })}>مغادرة الشلّة</button>
    </section>}
  </div>;
}
