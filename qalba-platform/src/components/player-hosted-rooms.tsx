"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RoomController, emptyView } from "@/lib/player-hosted/rooms/controller";
import { readGuest, rememberGuest } from "@/lib/player-hosted/rooms/client";

const labels = ["الهوست A", "اللاعب B", "اللاعب C", "اللاعب D"];
export function PlayerHostedRooms() {
  const [ui, setUi] = useState(emptyView);
  const [code, setCode] = useState("");
  const [share, setShare] = useState("");
  const [notice, setNotice] = useState("");
  const session = useRef<RoomController | null>(null);

  const begin = useCallback((role: "host" | "guest", room = "") => {
    if (session.current) return;
    const normalized = room.replace(/\s/g, "").toUpperCase();
    if (role === "guest" && !/^[A-F0-9]{32}$/.test(normalized)) {
      setNotice("أدخل رمز الدعوة الكامل المكوّن من 32 حرفًا ورقمًا."); return;
    }
    setNotice("");
    const controller = new RoomController(next => {
      if (session.current !== controller) return;
      setUi(next);
      if (next.phase === "closed") setShare("");
    });
    session.current = controller;
    let saved;
    try { saved = role === "guest" ? readGuest(sessionStorage, normalized) : undefined; } catch { /* optional */ }
    void controller.start(role, normalized, saved).then(credentials => {
      if (!credentials || session.current !== controller) return;
      if (role === "host") setShare(`${location.origin}/labs/player-hosted-rooms#room=${credentials.code}`);
      else {
        try { rememberGuest(sessionStorage, credentials); } catch { /* optional */ }
        history.replaceState(null, "", `#room=${credentials.code}`);
      }
    });
  }, []);

  useEffect(() => {
    const close = () => session.current?.close();
    window.addEventListener("pagehide", close);
    // Cancel the first Strict Mode effect pass before it can allocate a guest slot.
    const timer = setTimeout(() => {
      const room = new URLSearchParams(location.hash.slice(1)).get("room");
      if (room) { setCode(room); begin("guest", room); }
    }, 0);
    return () => {
      clearTimeout(timer); window.removeEventListener("pagehide", close);
      const controller = session.current; session.current = null; controller?.dispose();
    };
  }, [begin]);

  function reset() {
    const controller = session.current; session.current = null; controller?.dispose();
    history.replaceState(null, "", location.pathname + location.search);
    setCode(""); setUi(emptyView()); setShare(""); setNotice("أُغلقت التجربة. يمكنك إنشاء غرفة جديدة أو العودة كضيف.");
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(share); setNotice("نُسخ رابط الدعوة. شاركه مع اللاعبين الموثوقين فقط."); }
    catch { setNotice("تعذر النسخ الآلي؛ يمكنك تحديد رابط الدعوة ونسخه."); }
  }
  const active = ui.phase === "connected";
  const busy = ui.phase !== "idle";
  const connected = ui.players.filter(player => player.connected).length;
  return <div className="shell" style={{ maxWidth: 960, paddingBlock: 32 }}>
    <div className="page-title">
      <span className="eyebrow">مختبر مستقل · غرف تلقائية</span>
      <h1>غرف قدّام باستضافة اللاعب</h1>
      <p>أنشئ غرفة وشارك رابطها. جهاز الهوست يدير الجرس والنقاط، حتى ثلاثة ضيوف. تنتهي الغرفة عند إغلاق الهوست أو بعد 30 دقيقة.</p>
    </div>
    <section className="panel" style={{ padding: 24, marginBlock: 16 }}>
      <h2>إنشاء أو انضمام</h2>
      <div className="utility-links">
        {!busy && <button className="btn btn-primary" onClick={() => begin("host")}>إنشاء غرفة</button>}
        <button className="btn btn-outline" onClick={reset}>إغلاق وإعادة التجربة</button>
      </div>
      {!busy && <><label htmlFor="room-code">رمز الغرفة</label>
      <input id="room-code" className="form-input" dir="ltr" maxLength={40} autoComplete="off"
        value={code} onChange={event => setCode(event.target.value)} />
      <button className="btn btn-secondary" disabled={!code.trim()} onClick={() => begin("guest", code)}>انضمام للغرفة</button></>}
      {ui.code && <details open style={{ marginBlock: 16 }}>
        <summary>دعوة اللاعبين</summary>
        <p>رمز الدعوة: <strong dir="ltr" data-testid="invite-code">{ui.code}</strong></p>
        {share && <><label htmlFor="share-link">رابط المشاركة</label>
          <input id="share-link" dir="ltr" className="form-input" style={{ width: "100%" }} readOnly value={share} />
          <button className="btn btn-secondary" onClick={() => void copyLink()}>نسخ الرابط</button></>}
      </details>}
      <p role="status" aria-live="polite">{ui.status}</p>
      {notice && <p role="alert">{notice}</p>}
      {ui.role === "guest" && ui.phase === "failed" && <button className="btn btn-primary" disabled={ui.retries >= 3}
        onClick={() => void session.current?.retry().then(credentials => {
          if (credentials) { try { rememberGuest(sessionStorage, credentials); } catch { /* optional */ } }
        })}>إعادة الاتصال ({ui.retries}/3)</button>}
      <p className="muted">تجربة محلية ببيانات مؤقتة. قد تمنع بعض الشبكات الاتصال المباشر. لا تحفظ النتائج ولا تنتقل إدارة الغرفة إلى ضيف.</p>
    </section>
    {ui.role && <section className="panel" data-testid="game-panel" style={{ padding: 24, marginBlock: 16 }}>
      <h2>جولة الجرس</h2>
      <p data-testid="connection">أنت: {labels[ui.slot]} · {ui.phase === "closed" ? "الجلسة مغلقة" : active ? "متصل" : "غير متصل"}
        {ui.role === "host" && ` · الضيوف المتصلون: ${connected}/3`}</p>
      <p data-testid="round">الجولة {ui.state.round} · الحالة {ui.state.phase} · الإصدار {ui.state.version}</p>
      {ui.role === "host" && <p data-testid="players">{ui.players.map(player =>
        `${labels[player.slot]}: ${player.connected ? "متصل" : "غير متصل"}`).join(" · ")}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }} data-testid="scores">
        {labels.map((label, slot) => <p key={label}>{label}: <strong>{ui.state.scores[slot]}</strong></p>)}
      </div>
      <p data-testid="winner" aria-live="polite">{!active ? "الجرس مغلق لعدم وجود اتصال مباشر" : ui.state.winner !== null
        ? `أول ضغطة مقبولة: ${labels[ui.state.winner]}` : ui.state.phase === "open" ? "الجرس مفتوح" : "الجرس مغلق"}</p>
      <div className="utility-links">
        {ui.role === "host" ? <>
          <button className="btn btn-primary" disabled={!active || ui.state.round >= 100 || !["waiting", "result"].includes(ui.state.phase)} onClick={() => session.current?.action("open")}>فتح جولة</button>
          <button className="btn btn-secondary" disabled={!active || ui.state.phase !== "open"} onClick={() => session.current?.action("buzz")}>جرس الهوست</button>
          <button className="btn btn-success" disabled={!active || ui.state.phase !== "locked"} onClick={() => session.current?.action("award")}>احتساب نقطة للفائز</button>
          <button className="btn btn-outline" disabled={!active || !["open", "locked"].includes(ui.state.phase)} onClick={() => session.current?.action("skip")}>تجاوز الجولة</button>
        </> : <button className="btn btn-primary" disabled={!active || ui.state.phase !== "open"} onClick={() => session.current?.buzz()}>اضغط الجرس</button>}
      </div>
      <p className="muted">الأسبقية حسب أول طلب يصل إلى جهاز الهوست. الهوست وحده يحتسب النقاط، ويمكن لهوست غير أمين التلاعب بالنتائج.</p>
    </section>}
  </div>;
}
