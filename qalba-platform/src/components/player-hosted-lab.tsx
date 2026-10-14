"use client";

import { useEffect, useRef, useState } from "react";
import { initialLabState, MAX_ROUNDS } from "@/lib/player-hosted/lab";
import { LabSession, type LabRole, type SessionView } from "@/lib/player-hosted/session";

const initialView = (): SessionView => ({
  state: initialLabState(), connected: false, working: false, ended: false,
  localSignal: "", remoteApplied: false,
  status: "اختر دورك للبدء. التجربة لا تحفظ بيانات على الخادم.",
});

export function PlayerHostedLab() {
  const [role, setRole] = useState<LabRole | null>(null);
  const [ui, setUi] = useState<SessionView>(initialView);
  const [remoteSignal, setRemoteSignal] = useState("");
  const sessionRef = useRef<LabSession | null>(null);
  const { state: view, connected, working, ended, localSignal, remoteApplied, status } = ui;

  useEffect(() => {
    const closePage = () => sessionRef.current?.close();
    window.addEventListener("pagehide", closePage);
    return () => {
      window.removeEventListener("pagehide", closePage);
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, []);

  function begin(mode: LabRole) {
    if (sessionRef.current) return;
    const session = new LabSession(mode, next => {
      if (sessionRef.current !== session) return;
      setUi(next);
      if (next.connected || next.ended) setRemoteSignal("");
    });
    sessionRef.current = session;
    setRole(mode);
    if (mode === "host") void session.startHost();
    else setUi({ ...initialView(), status: "الصق عرض الهوست أدناه ثم اختر إنشاء الإجابة" });
  }

  async function copySignal() {
    const session = sessionRef.current;
    try {
      await navigator.clipboard.writeText(localSignal);
      if (session && sessionRef.current === session) setUi(current => ({ ...current, status: "نُسخت رسالة الاتصال. شاركها مع اللاعب الموثوق فقط." }));
    } catch {
      if (session && sessionRef.current === session) setUi(current => ({ ...current, status: "تعذر النسخ الآلي؛ حدّد النص وانسخه يدويًا." }));
    }
  }

  function reset() {
    sessionRef.current?.dispose();
    sessionRef.current = null;
    setRole(null); setRemoteSignal("");
    setUi({ ...initialView(), status: "تم إغلاق الجلسة ومسح الحالة المؤقتة من الواجهة." });
  }

  return <div className="shell" style={{ paddingBlock: 32, maxWidth: 900 }}>
    <div className="page-title">
      <span className="eyebrow">مختبر مستقل · إثبات فكرة</span>
      <h1>الجرس باستضافة اللاعب P2P</h1>
      <p>الهوست يدير الجولة والنقاط من متصفحه؛ الضيف يستطيع إرسال ضغطة الجرس فقط. لا تُربط هذه النتائج بالحسابات أو الألعاب الفعلية.</p>
    </div>
    <section className="panel" style={{ padding: 24, marginBlock: 16 }}>
      <h2 style={{ fontSize: "1.4rem" }}>1. اختر الدور</h2>
      <div className="utility-links">
        <button type="button" className="btn btn-primary" disabled={role !== null || working} onClick={() => begin("host")}>أنا الهوست · الفريق A</button>
        <button type="button" className="btn btn-secondary" disabled={role !== null || working} onClick={() => begin("guest")}>أنا الضيف · الفريق B</button>
        <button type="button" className="btn btn-outline" onClick={reset}>إغلاق وإعادة التجربة</button>
      </div>
      <p role="status" aria-live="polite">{status}</p>
      <p className="muted">ابدأ عبر localhost أو HTTPS. لا توجد خدمة Signaling أو STUN/TURN؛ اختبر على جهاز واحد أو شبكة محلية أولًا. بيانات SDP قد تكشف معلومات اتصال، فلا تنشرها.</p>
    </section>
    {role && !connected && !ended && <section className="panel" style={{ padding: 24, marginBlock: 16 }}>
      <h2 style={{ fontSize: "1.4rem" }}>2. الربط اليدوي الآمن</h2>
      <p>{role === "host" ? "أرسل العرض إلى الضيف، ثم استلم الإجابة والصقها هنا." : "استلم عرض الهوست والصقه، ثم أنشئ إجابة وأعدها إليه."}</p>
      {localSignal && <div style={{ marginBlock: 12 }}>
        <label htmlFor="lab-local-sdp">رسالتك {role === "host" ? "(Offer)" : "(Answer)"}</label>
        <textarea id="lab-local-sdp" dir="ltr" className="form-input" style={{ width: "100%", minHeight: 110 }} readOnly spellCheck={false} value={localSignal}/>
        <button className="btn btn-secondary" type="button" onClick={() => void copySignal()}>نسخ رسالتي</button>
      </div>}
      <label htmlFor="lab-remote-sdp">رسالة الطرف الآخر {role === "host" ? "(Answer)" : "(Offer)"}</label>
      <textarea id="lab-remote-sdp" dir="ltr" className="form-input" style={{ width: "100%", minHeight: 110 }} spellCheck={false} maxLength={100000} value={remoteSignal} onChange={event => setRemoteSignal(event.target.value)} placeholder="الصق JSON هنا" />
      <button className="btn btn-primary" type="button" disabled={working || !remoteSignal.trim() || connected || ended || remoteApplied || (role === "host" && !localSignal)}
        onClick={() => void (role === "host" ? sessionRef.current?.acceptAnswer(remoteSignal) : sessionRef.current?.acceptOffer(remoteSignal))}>
        {working ? "جاري التجهيز…" : role === "host" ? "تأكيد إجابة الضيف" : "إنشاء الإجابة"}
      </button>
    </section>}
    {role && <section className="panel" style={{ padding: 24, marginBlock: 16 }}>
      <h2 style={{ fontSize: "1.4rem" }}>3. جولة الجرس</h2>
      <p>الاتصال: <strong>{connected ? "متصل" : "غير متصل"}</strong> · الجولة {view.round} · الحالة {view.phase} · الإصدار {view.version}</p>
      <p>الفريق A (الهوست): <strong>{view.scores[0]}</strong> | الفريق B (الضيف): <strong>{view.scores[1]}</strong></p>
      <p aria-live="polite">{!connected ? "الجرس مغلق لعدم وجود اتصال مباشر" : view.phase === "locked" || (view.phase === "result" && view.winner !== null)
        ? `أول ضغطة مقبولة: الفريق ${view.winner === 0 ? "A" : "B"}`
        : view.phase === "open" ? "الجرس مفتوح للفريقين" : "الجرس مغلق"}</p>
      <div className="utility-links">
        {role === "host" ? <>
          <button className="btn btn-primary" disabled={!connected || view.round >= MAX_ROUNDS || (view.phase !== "waiting" && view.phase !== "result")} onClick={() => sessionRef.current?.hostAction("open")}>فتح جولة</button>
          <button className="btn btn-secondary" disabled={!connected || view.phase !== "open"} onClick={() => sessionRef.current?.hostAction("buzz")}>جرس الفريق A</button>
          <button className="btn btn-success" disabled={!connected || view.phase !== "locked"} onClick={() => sessionRef.current?.hostAction("award")}>احتساب نقطة للفائز</button>
          <button className="btn btn-outline" disabled={!connected || (view.phase !== "open" && view.phase !== "locked")} onClick={() => sessionRef.current?.hostAction("skip")}>تجاوز الجولة دون نقطة</button>
        </> : <button className="btn btn-primary" disabled={!connected || view.phase !== "open"} onClick={() => sessionRef.current?.guestBuzz()}>اضغط الجرس · الفريق B</button>}
      </div>
      <p className="muted">الهوست وحده يحتسب النقاط. الأسبقية حسب أول طلب يصل إلى جهازه، لا حسب زمن الضغط الحقيقي. عند إغلاق الهوست تنتهي الجلسة.</p>
    </section>}
  </div>;
}
