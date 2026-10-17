"use client";

import { formatNumber } from "@/lib/format-number";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nightGameTitle } from "@/lib/night/catalog";
import { deriveNightHighlights } from "@/lib/night/highlights";
import { NightInvitationSetup } from "./night-invitation-setup";
import type { NightCommandInput, NightView } from "@/lib/night/types";

const PHASE_LABEL: Record<NightView["phase"], string> = {
  preparing: "تجهيز السهرة", playing: "السهرة جارية", completed: "اكتملت السهرة", ended: "انتهت قبل الاكتمال",
};

function readNight(value: unknown, expectedId: string): NightView {
  const night = value && typeof value === "object" && "night" in value ? value.night : null;
  if (!night || typeof night !== "object" || !("id" in night) || night.id !== expectedId || !("version" in night) || !Number.isSafeInteger(night.version)) throw new Error("Invalid night response");
  return night as NightView;
}

function commandFailure(status: number) {
  if (status === 402) return "لا يكفي الرصيد لبدء المباراة. راجع رصيدك قبل إعادة المحاولة.";
  if (status === 409) return "تغيرت حالة السهرة أو المباراة. جارٍ قراءة الحالة المحفوظة قبل أي محاولة أخرى.";
  if (status === 403 || status === 404) return "تعذر الوصول إلى هذه السهرة بحسابك الحالي.";
  if (status === 429) return "طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة.";
  return "تعذر تنفيذ الأمر. تحقّق من اكتمال المباراة وتوفر الألعاب والرصيد، ثم أعد المحاولة.";
}

export function NightOfQuddam({ initial }: { initial: NightView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("");
  const current = useRef(initial);
  const pending = useRef<NightCommandInput | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const autoAttempted = useRef<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const publish = useCallback((next: NightView) => {
    if (!mounted.current || next.id !== initial.id || next.version < current.current.version) return;
    current.current = next;
    setView(next);
  }, [initial.id]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/night/${initial.id}`, { credentials: "same-origin", cache: "no-store", signal });
    if (response.status === 401) { router.push("/login"); throw new Error("Authentication required"); }
    if (!response.ok) throw new Error("Night read unavailable");
    const next = readNight(await response.json(), initial.id);
    publish(next);
    if (mounted.current) setConnection("");
  }, [initial.id, publish, router]);

  const send = useCallback(async (op: NightCommandInput["op"]) => {
    if (inFlight.current) return;
    if (pending.current && pending.current.op !== op) {
      setError("أعد محاولة الأمر المعلّق أولًا للتحقق من نتيجته، قبل إرسال أمر جديد.");
      return;
    }
    const body = pending.current ?? { key: crypto.randomUUID(), expectedVersion: current.current.version, op };
    pending.current = body;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 15_000);
    try {
      const response = await fetch(`/api/night/${initial.id}/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(body), signal: abort.signal });
      if (response.status === 401) { router.push("/login"); return; }
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          pending.current = null;
          if (mounted.current) { setUncertain(false); setError(commandFailure(response.status)); }
          if (response.status === 409) await refresh();
          return;
        }
        throw new Error("Unconfirmed command");
      }
      const next = readNight(await response.json(), initial.id);
      pending.current = null;
      publish(next);
      if (mounted.current) { setUncertain(false); setConfirmEnd(false); }
    } catch {
      if (mounted.current) {
        setUncertain(pending.current !== null);
        setError("تعذر التأكد من نتيجة الأمر. أعد المحاولة بالأمر نفسه؛ لن تتكرر المباراة أو النقاط أو الخصم.");
      }
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [initial.id, publish, refresh, router]);

  useEffect(() => {
    if (view.phase === "completed" || view.phase === "ended") return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function poll() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10_000);
      try { await refresh(controller.signal); }
      catch { if (live && mounted.current) setConnection("تعذر تحديث السهرة مؤقتًا. نعرض آخر حالة محفوظة ونعيد الاتصال تلقائيًا."); }
      finally {
        clearTimeout(timeout);
        if (live) timer = setTimeout(() => void poll(), 2_000);
      }
    }
    timer = setTimeout(() => void poll(), 2_000);
    return () => { live = false; clearTimeout(timer); controller?.abort(); };
  }, [refresh, view.phase]);

  useEffect(() => {
    const observation = `${view.version}:${view.currentIndex}`;
    if (view.phase === "playing" && view.importReady && !busy && !uncertain && autoAttempted.current !== observation) {
      autoAttempted.current = observation;
      void send("IMPORT");
    }
  }, [view.phase, view.importReady, view.version, view.currentIndex, busy, uncertain, send]);

  const recap = deriveNightHighlights(view);
  const latestResult = view.results.at(-1);
  const atTransition = view.phase === "playing" && view.canNext && latestResult;
  const currentSlot = view.games[view.currentIndex];
  const locked = busy || uncertain;
  const champions = view.phase === "completed" ? view.teams.filter(team => view.winnerIds.includes(team.id)) : [];

  return <div className="shell" data-testid="night-dashboard" data-phase={view.phase} data-version={view.version}>
    <div className="page-title"><span className="eyebrow">ليلتكم، لعبة وراء لعبة</span><h1>ليلة قدّام</h1><p data-testid="night-status" role="status">{PHASE_LABEL[view.phase]} · اكتملت {formatNumber(view.results.length)} من {formatNumber(view.games.length)} ألعاب</p></div>
    {connection && <p role="status" className="form-note">{connection}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {uncertain && <button className="btn btn-secondary" data-testid="night-retry" disabled={busy} onClick={() => { const command = pending.current; if (command) void send(command.op); }}>{busy ? "جارٍ التحقق…" : "إعادة محاولة الأمر المعلّق"}</button>}

    {view.phase === "completed" && <section className="panel night-champion" data-testid="night-champion" aria-labelledby="night-champion-title">
      <span className="night-crown" aria-hidden="true">♛</span><span className="eyebrow">اكتمل مشوار الليلة</span>
      <h2 id="night-champion-title">{champions.length > 1 ? "أبطال الليلة" : "بطل الليلة"}</h2>
      <p className="night-winner-name">{champions.map(team => team.name).join(" و ")}</p>
      <strong className="night-winner-total">{champions.map(team => formatNumber(view.totals[team.id])).join(" · ")} <small>نقطة</small></strong>
      {champions.length > 1 && <p>تعادل يستاهل الاحتفال! كلهم أبطال الليلة.</p>}
      <div className="night-ranking-bars" aria-label="ترتيب الفرق">{view.ranking.map((team, index) => <div className="night-ranking-row" key={team.id}><div><strong>{formatNumber(index + 1)}. {team.name}</strong><b>{formatNumber(team.points)}</b></div><div className="night-ranking-track"><span className={`night-ranking-fill night-team-${view.teams.findIndex(item => item.id === team.id)}`} style={{ width: `${Math.max(0, Math.min(100, team.points / Math.max(1, ...view.ranking.map(item => item.points)) * 100))}%` }} /></div></div>)}</div>
      <div className="night-completed-badges" aria-label="الألعاب المكتملة">{view.games.map(game => <span key={game.game}>✓ {game.title}</span>)}</div>
      <div className="night-champion-actions"><Link className="btn btn-primary" href="/night/new">سهرة جديدة</Link><a className="btn btn-secondary" href={`/api/night/${encodeURIComponent(view.id)}/share-card`} download="quddam-night.png" data-testid="night-share-card">شارك النتيجة</a><button className="btn btn-outline night-details-link" type="button" onClick={() => { const details = document.getElementById("night-details") as HTMLDetailsElement | null; const results = document.getElementById("night-results-fold") as HTMLDetailsElement | null; if (details) { details.open = true; details.scrollIntoView({ block: "start", behavior: "smooth" }); } if (results) results.open = true; }}>التفاصيل</button></div>
      <p className="night-tv-note">المضيف: ابدأ سهرة جديدة من جوالك</p>
    </section>}
    {view.phase === "ended" && <section className="panel" data-testid="night-ended"><h2>انتهت السهرة قبل الاكتمال</h2><p>النتائج المعتمدة محفوظة أدناه، ولم يُعلن بطل لليلة غير مكتملة. إغلاق السهرة لا يلغي مباراة قائمة ولا يعيد الرصيد المستهلك.</p></section>}

    <details className="night-details" id="night-details" open={view.phase !== "completed" && !atTransition ? true : undefined}><summary>التفاصيل · نقاط السهرة</summary>
    <section className="panel" aria-labelledby="night-board-title" style={{ marginBlock: "1rem" }}><h2 id="night-board-title">نقاط السهرة</h2><div style={{ overflowX: "auto" }}><table className="bluff-leaderboard" data-testid="night-leaderboard"><caption className="visually-hidden">مجموع نقاط السهرة لكل فريق</caption><thead><tr><th scope="col">الترتيب</th><th scope="col">الفريق</th><th scope="col">نقاط السهرة</th></tr></thead><tbody>{view.ranking.map(team => <tr key={team.id} data-team={team.id}><td>{formatNumber(1 + view.ranking.filter(other => other.points > team.points).length)}</td><th scope="row">{team.name}</th><td data-testid="night-total">{formatNumber(team.points)}</td></tr>)}</tbody></table></div><p className="form-note">الأول: {formatNumber(3)} نقاط · الثاني: نقطتان · الثالث: نقطة. التعادل يمنح الفرق المتعادلة نقاط المركز نفسه، ويُتجاوز عدد المراكز المشغولة.</p></section></details>

    {view.phase === "preparing" && <NightInvitationSetup nightId={view.id} />}
    {view.phase === "preparing" && <section className="panel" data-testid="night-preparing"><h2>كل شيء جاهز؟</h2><p>جهّزوا أول مباراة من ترتيب السهرة. تُنشأ المباراة الأصلية بالفريقين نفسيهما، ثم تُفتح من رابط المضيف.</p><p>بدء السهرة هنا يجهّز المباراة دون خصم. تُستهلك لعبة واحدة فقط عند بدء اللعب داخل واجهتها الأصلية.</p><button className="btn btn-primary" data-testid="night-start" disabled={locked} onClick={() => void send("START")}>{busy ? "جارٍ التجهيز…" : "ابدأ السهرة"}</button></section>}

    {view.phase === "playing" && view.current && !atTransition && <section className="panel" data-testid="night-current" style={{ marginBlock: "1rem" }}><span className="eyebrow">اللعبة {formatNumber(view.current.index + 1)} من {formatNumber(view.games.length)}</span><h2>{view.current.title}</h2><p>العبوا المباراة كاملة في واجهتها الأصلية. بعد اكتمالها تُقرأ نتيجتها المحفوظة وتُضاف نقاط السهرة تلقائيًا.</p>{view.current.hostHref && <Link className="btn btn-primary" data-testid="night-source-link" href={view.current.hostHref}>افتح مباراة {view.current.title}</Link>}<p className="form-note">أكملوا جميع الجولات ثم اضغطوا «أكمل المباراة». إنهاء المباراة مبكرًا أو إعادة المباراة نفسها يمنع اعتمادها للسهرة.</p><p className="form-note">رابط العودة إلى السهرة ظاهر في صفحة المضيف. تحديث الصفحة لا يغيّر هوية السهرة أو الفريقين.</p>{view.blockedReason && <p className="form-error" role="status">تحتاج حالة المباراة إلى مراجعة قبل اعتماد نتيجتها. لن تُضاف نقاط أو تُفتح اللعبة التالية في هذه الحالة.</p>}{view.importReady && <button className="btn btn-secondary" data-testid="night-import" disabled={locked} onClick={() => void send("IMPORT")}>{busy ? "جارٍ اعتماد النتيجة…" : "اعتماد نتيجة المباراة المكتملة"}</button>}</section>}

    {atTransition && <section className="panel night-transition" data-testid="night-transition" style={{ marginBlock: "1rem" }} aria-labelledby="night-transition-title"><span className="eyebrow">النتيجة معتمدة</span><h2 id="night-transition-title">خلصت {nightGameTitle(latestResult.game)}!</h2>
      <ol className="night-progress" aria-label="تقدّم ألعاب الليلة">{view.games.map((game, index) => <li key={game.game} aria-label={`${game.title}: ${game.imported ? "مكتملة" : index === view.currentIndex + 1 ? "التالية" : "بانتظار دورها"}`}><span aria-hidden="true">{game.imported ? "✓" : index === view.currentIndex + 1 ? "●" : "○"}</span><small>{game.title}</small></li>)}</ol>
      <div className="night-transition-scores">{view.teams.map((team, index) => <div className={`night-transition-team night-team-${index}`} key={team.id}><strong>{team.name}</strong><b>{formatNumber(view.totals[team.id])}</b><small>+{formatNumber(latestResult.points[team.id])} من اللعبة الماضية</small></div>)}</div>
      <p>التالي: <strong>{view.games[view.currentIndex + 1]?.title ?? "اكتملت الألعاب"}</strong></p><p className="form-note">الانتقال يجهّز المباراة التالية دون خصم. تُستهلك اللعبة عند بدء المباراة داخل واجهتها الأصلية.</p><button className="btn btn-primary night-next-button" data-testid="night-next" disabled={locked} onClick={() => void send("NEXT")}>{busy ? "جارٍ التجهيز…" : "اللعبة التالية"}</button></section>}

    <section className="panel" style={{ marginBlock: "1rem" }} aria-labelledby="night-order-title"><h2 id="night-order-title">مشوار الليلة</h2><ol className="history-list" data-testid="night-games">{view.games.map((game, index) => <li className="history-row" key={game.game} data-game={game.game} data-imported={game.imported}><span>{formatNumber(index + 1)}. {game.title}</span><strong>{game.imported ? "اكتملت واعتمدت نتيجتها" : view.phase === "ended" ? "لم تُعتمد" : index === view.currentIndex && currentSlot?.hostHref ? "المباراة الحالية" : "بانتظار دورها"}</strong></li>)}</ol></section>

    {view.results.length > 0 && <details className="night-details night-results-fold" id="night-results-fold" open={!atTransition && view.phase !== "completed" ? true : undefined}><summary>نتائج المباريات المعتمدة</summary><section className="panel" data-testid="night-results" aria-labelledby="night-results-title"><h2 id="night-results-title">نتائج المباريات المعتمدة</h2><div className="history-list">{view.results.map((result, index) => <article className="info-card" key={result.sourceSessionId} data-game={result.game}><h3>{formatNumber(index + 1)}. {nightGameTitle(result.game)}</h3>{result.placements.map((placement, place) => <p key={place}>المركز {formatNumber(1 + result.placements.slice(0, place).reduce((sum, group) => sum + group.teamIds.length, 0))}: {placement.teamIds.map(id => view.teams.find(team => team.id === id)?.name ?? "فريق").join(" و ")}</p>)}<ul>{view.teams.map(team => <li key={team.id}>{team.name}: {formatNumber(result.points[team.id])} نقاط للسهرة</li>)}</ul></article>)}</div></section></details>}

    {recap && <section className="panel" data-testid="night-highlights" aria-labelledby="night-highlights-title" style={{ marginBlock: "1rem" }}>
      <span className="eyebrow">مبنية على النتائج المعتمدة فقط</span><h2 id="night-highlights-title">هايلايتس السهرة</h2>
      <ul>{recap.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>
      {recap.games.map((game, i) => <p key={`${game.title}-${i}`}><strong>{game.title}:</strong> تصدّر {game.firstNames.join(" و ")}</p>)}
      {view.phase === "completed" && <p className="form-note">بطاقة المشاركة خاصة بمنظّم السهرة، ولا تُنشر تلقائيًا.</p>}
    </section>}
    <div className="utility-links" style={{ marginBlock: "1rem" }}><Link className="btn btn-secondary" href="/games">قائمة الألعاب</Link>{view.phase === "ended" && <Link className="btn btn-primary" href="/night/new">ابدأ سهرة جديدة</Link>}{(view.phase === "playing" || view.phase === "preparing") && !confirmEnd && <button className="btn btn-danger" data-testid="night-end" disabled={locked} onClick={() => setConfirmEnd(true)}>إنهاء السهرة مبكرًا</button>}</div>
    {confirmEnd && <section className="panel" role="group" aria-labelledby="night-end-title"><h2 id="night-end-title">إنهاء السهرة قبل الاكتمال؟</h2><p>ستبقى النتائج المعتمدة محفوظة، ولن يُعلن بطل. لا يلغي هذا مباراة قائمة ولا يعيد الرصيد المستهلك.</p><div className="utility-links"><button className="btn btn-danger" data-testid="night-end-confirm" disabled={locked} onClick={() => void send("END")}>نعم، أنهِ السهرة</button><button className="btn btn-secondary" disabled={locked} onClick={() => setConfirmEnd(false)}>متابعة السهرة</button></div></section>}
  </div>;
}
