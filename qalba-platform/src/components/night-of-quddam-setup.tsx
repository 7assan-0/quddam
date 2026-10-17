"use client";

import { formatNumber } from "@/lib/format-number";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NIGHT_GAMES, type NightGameSlug } from "@/lib/night/catalog";
import type { NightCreateInput } from "@/lib/night/types";

const GAME_CONSTRAINTS: Record<NightGameSlug, string> = {
  "top-list": "خمس جولات كاملة · فريقان · يدير المضيف المحاولات وكشف الإجابات.",
  "ordering-challenge": "سبع جولات كاملة · فريقان · تحتاجون جوالًا أو صفحة تحكم لكل فريق؛ الترتيب خاص حتى الكشف.",
  "survey-show": "خمسة أسئلة كاملة · فريقان · يعتمد التحكيم على المضيف، وأوزان الإجابات محتوى محرر للعبة.",
};

export function NightOfQuddamSetup() {
  const router = useRouter();
  const [games, setGames] = useState<NightGameSlug[]>(NIGHT_GAMES.map(game => game.game));
  const [teams, setTeams] = useState<[string, string]>(["الفريق أ", "الفريق ب"]);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<NightCreateInput | null>(null);
  const inFlight = useRef(false);

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= games.length) return;
    setGames(current => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || games.length !== 3) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const body = pending.current ?? { key: crypto.randomUUID(), games: [...games], teams: [...teams] as [string, string] };
    pending.current = body;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 15_000);
    try {
      const response = await fetch("/api/night", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(body), signal: abort.signal });
      if (response.status === 401) { router.push("/login"); return; }
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          pending.current = null;
          setUncertain(false);
          setError(response.status === 429 ? "طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة." : "تعذر إنشاء السهرة. تحقّق من أسماء الفريقين وتوفر الألعاب، ثم أعد المحاولة.");
          return;
        }
        throw new Error("Unconfirmed creation");
      }
      const data: unknown = await response.json();
      const night = data && typeof data === "object" && "night" in data ? data.night : null;
      if (!night || typeof night !== "object" || !("id" in night) || typeof night.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(night.id)) throw new Error("Invalid creation response");
      pending.current = null;
      setUncertain(false);
      router.push(`/night/${night.id}`);
    } catch {
      setUncertain(true);
      setError("تعذر التأكد من إنشاء السهرة. أعد المحاولة بالبيانات نفسها؛ لن تتكرر العملية.");
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
      setBusy(false);
    }
  }

  const locked = busy || uncertain;
  return <div className="shell" data-testid="night-setup">
    <div className="page-title"><span className="eyebrow">ليلة قدّام</span><h1>جهّزوا سهرتكم</h1><p>ثلاث ألعاب محددة، وفريقان ثابتان طوال الليلة.</p></div>
    <form className="panel" onSubmit={event => void create(event)} aria-busy={busy}>
      <fieldset disabled={locked} style={{ border: 0, padding: 0, minWidth: 0 }}><legend><h2>اختاروا ترتيب الألعاب</h2></legend>
        <p id="night-order-help">الألعاب الثلاث مختارة. غيّروا ترتيبها بأزرار التقديم والتأخير قبل إنشاء السهرة.</p><p className="form-note">تُخصم لعبة واحدة عند بدء كل مباراة فقط.</p>
        <ol className="history-list" data-testid="night-game-order" aria-describedby="night-order-help">
          {games.map((slug, index) => {
            const game = NIGHT_GAMES.find(choice => choice.game === slug)!;
            return <li className="item" key={slug} data-game={slug} style={{ flexWrap: "wrap" }}><div><h3>{game.title}</h3><p>{GAME_CONSTRAINTS[slug]}</p></div><div className="item-actions"><button className="btn btn-secondary" type="button" disabled={index === 0} aria-label={`قدّم ${game.title} في ترتيب السهرة`} onClick={() => move(index, -1)}>تقديم</button><button className="btn btn-secondary" type="button" disabled={index === games.length - 1} aria-label={`أخّر ${game.title} في ترتيب السهرة`} onClick={() => move(index, 1)}>تأخير</button></div></li>;
          })}
        </ol>
      </fieldset>
      <fieldset disabled={locked} style={{ border: 0, padding: 0, minWidth: 0 }}><legend><h2>الفريقان</h2></legend><div className="profile-grid">{teams.map((name, index) => <div className="field" key={index}><label htmlFor={`night-team-${index}`}>اسم الفريق {index === 0 ? "أ" : "ب"}</label><input className="input" id={`night-team-${index}`} data-testid={index === 0 ? "night-team-a" : "night-team-b"} value={name} required minLength={2} maxLength={60} autoComplete="off" onChange={event => setTeams(current => index === 0 ? [event.target.value, current[1]] : [current[0], event.target.value])}/></div>)}</div></fieldset>
      <p className="form-note">تحتاج الليلة رصيد ${formatNumber(3)} ألعاب.</p>
      <ul className="night-setup-rules"><li>إنشاء السهرة والتنقل بين مبارياتها لا يخصمان رصيدًا.</li><li>أكملوا كل جولات المباراة، ثم اضغطوا «أكمل المباراة».</li><li>النتائج تُقرأ تلقائيًا؛ الإنهاء المبكر وإعادة المباراة لا يُعتمدان.</li></ul>
      <details><summary>تفاصيل إضافية</summary><p>يمكن إنهاء السهرة غير المكتملة دون إعلان بطل.</p></details>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="utility-links"><button className="btn btn-primary" data-testid="night-create" type="submit" disabled={busy || games.length !== 3}>{busy ? "جارٍ إنشاء السهرة…" : uncertain ? "إعادة محاولة إنشاء السهرة" : "أنشئ السهرة"}</button><Link className="btn btn-secondary" href="/night">العودة</Link></div>
    </form>
  </div>;
}
