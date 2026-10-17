import { formatNumber } from "@/lib/format-number";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { walletForAccount } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { historyHref } from "@/lib/games/history-policy";

import { saudiDate as date, sessionHistorySummary } from "@/lib/admin/metric-policy";
const statuses: Record<string, string> = { LOBBY: "بانتظار البدء", READY: "جاهزة", IN_PROGRESS: "جارية", PAUSED: "متوقفة مؤقتًا", COMPLETED: "انتهت", ABANDONED: "أُلغيت" };

export default async function ProfilePage() {
  const user = await requireUser();
  const wallet = await walletForAccount(user.id);
  const [games, purchases, entries] = await Promise.all([
    db().gameSession.findMany({ where: { hostId: user.id }, include: { gameType: { select: { title: true, slug: true } }, teams: { select: { id: true, name: true, score: true, position: true } }, bluffParticipants: { select: { name: true, score: true, position: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    db().purchase.findMany({ where: { userId: user.id }, include: { product: { select: { title: true } }, refund: { select: { state: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db().gameCredit.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return <div className="shell profile-page">
    <div className="page-title"><span className="eyebrow">حسابي</span><h1>الملف الشخصي</h1><p>جلساتك ورصيد ألعابك في مكان واحد.</p></div>
    <div className="profile-grid"><section className="panel"><h2>{user.name}</h2><p><span className="muted">البريد الإلكتروني:</span> <b dir="ltr">{user.email}</b></p><p><span className="muted">تاريخ الانضمام:</span> {date(user.createdAt)}</p><Link className="btn btn-secondary" href="/games">العودة للمكتبة</Link><Link className="btn btn-primary" href="/pricing">شراء ألعاب</Link></section>
      <section className="panel credit-panel"><span className="eyebrow">المحفظة</span><strong className="stat">{wallet.balance}</strong><h2>ألعاب متاحة</h2><p className="muted">تُخصم لعبة واحدة عند بدء مباراة جديدة. العودة لنفس المباراة لا تخصم رصيدًا إضافيًا.</p>{wallet.balance === 0 && <p>الرصيد منتهٍ. اختر باقة لإضافة ألعاب.</p>}</section></div>
    <section className="section"><div className="section-head"><div><span className="eyebrow">سجل اللعب</span><h2>جلساتك</h2><p className="muted">آخر حالة لكل جلسة؛ إعادة المباراة داخل الجلسة لا تنشئ بطاقة جديدة.</p></div></div>{games.length === 0 ? <div className="empty">لم تبدأ أي مباراة بعد. <Link className="subtle-link" href="/games/category-board/new">جهّز أول مباراة</Link></div> : <div className="history-list">{games.map(game => <article className="panel history-row" key={game.id}><div><span className="eyebrow">{game.gameType.title} · {statuses[game.status]}</span><h3>{sessionHistorySummary(game).text}</h3><small className="muted">{date(game.createdAt)}{sessionHistorySummary(game).match ? ` · المباراة الحالية ${sessionHistorySummary(game).match}` : ""}</small></div><Link className="btn btn-secondary" href={historyHref(game)}>{game.status === "COMPLETED" ? "عرض النتيجة" : "العودة للمباراة"}</Link></article>)}</div>}</section>
    <div className="profile-grid section"><section><div className="section-head"><div><span className="eyebrow">المحفظة</span><h2>حركة الرصيد</h2></div></div>{entries.length === 0 ? <div className="empty">لا توجد حركة رصيد.</div> : <div className="history-list">{entries.map(entry => <div className="panel ledger-row" key={entry.id}><span>{entry.reason}<small className="muted">{date(entry.createdAt)}</small></span><strong className={entry.delta > 0 ? "positive" : "negative"} dir="ltr">{entry.delta > 0 ? "+" : ""}{entry.delta}</strong></div>)}</div>}</section>
      <section><div className="section-head"><div><span className="eyebrow">المشتريات</span><h2>سجل الشراء</h2></div></div>{purchases.length === 0 ? <div className="empty">لا توجد مشتريات بعد.</div> : <div className="history-list">{purchases.map(purchase => <div className="panel ledger-row" key={purchase.id}><span>{purchase.product.title} · {purchase.credits} ألعاب<small className="muted">{date(purchase.createdAt)} · {purchase.status}{purchase.refund ? " · استرداد مؤكد" : ""}</small></span><strong>{formatNumber(purchase.amountHalalas / 100, { style: "currency", currency: "SAR" })}</strong></div>)}</div>}</section></div>
  </div>;
}
