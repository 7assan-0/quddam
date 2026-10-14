"use client";

import { useEffect, useRef, useState } from "react";
import {
  awardPoint, buzz, initialLabState, openRound, parseGuestIntent,
  parseHostSnapshot, parseSessionDescription, skipRound,
  type LabState,
} from "@/lib/player-hosted/lab";

type Role = "host" | "guest";
const TIMEOUT_MS = 15000;

async function completeIce(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const finish = () => { clearTimeout(timer); peer.removeEventListener("icegatheringstatechange", changed); peer.removeEventListener("connectionstatechange", changed); };
    const changed = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "closed") { finish(); reject(new Error("فشل تجهيز اتصال WebRTC")); }
      else if (peer.iceGatheringState === "complete") { finish(); resolve(); }
    };
    const timer = setTimeout(() => { finish(); reject(new Error("انتهت مهلة جمع ICE. لا يوجد سيرفر STUN/TURN في هذه التجربة.")); }, TIMEOUT_MS);
    peer.addEventListener("icegatheringstatechange", changed);
    peer.addEventListener("connectionstatechange", changed);
    changed();
  });
}

export function PlayerHostedLab() {
  const [role, setRole] = useState<Role | null>(null);
  const [status, setStatus] = useState("اختر دورك للبدء. التجربة لا تحفظ بيانات على الخادم.");
  const [localSignal, setLocalSignal] = useState("");
  const [remoteSignal, setRemoteSignal] = useState("");
  const [connected, setConnected] = useState(false);
  const [working, setWorking] = useState(false);
  const [view, setView] = useState<LabState>(initialLabState);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const stateRef = useRef<LabState>(initialLabState());
  const roleRef = useRef<Role | null>(null);

  useEffect(() => () => {
    channelRef.current?.close();
    peerRef.current?.close();
  }, []);

  function fail(error: unknown) {
    setStatus(error instanceof Error ? error.message : "تعذر إكمال الاتصال");
    setWorking(false);
  }

  function updateHost(apply: (current: LabState) => LabState) {
    if (roleRef.current !== "host") return;
    const next = apply(stateRef.current);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setView(next);
    if (channelRef.current?.readyState === "open") channelRef.current.send(JSON.stringify(next));
  }

  function attachChannel(channel: RTCDataChannel, mode: Role) {
    if (channelRef.current) { channel.close(); return; } // one trusted guest only
    channelRef.current = channel;
    channel.onopen = () => {
      setConnected(true);
      setStatus("الاتصال المباشر جاهز");
      if (mode === "host") channel.send(JSON.stringify(stateRef.current));
    };
    channel.onclose = () => { setConnected(false); setStatus("انقطع اتصال اللاعب. أعد إنشاء التجربة للاتصال من جديد."); };
    channel.onerror = () => { setStatus("حدث خطأ في قناة البيانات"); };
    channel.onmessage = event => {
      if (typeof event.data !== "string") return;
      if (mode === "host") {
        const intent = parseGuestIntent(event.data);
        if (intent) updateHost(current => buzz(current, 1, intent.round));
      } else {
        const snapshot = parseHostSnapshot(event.data);
        if (snapshot && snapshot.version >= stateRef.current.version) {
          stateRef.current = snapshot;
          setView(snapshot);
        }
      }
    };
  }

  function makePeer(mode: Role): RTCPeerConnection {
    // No external STUN/TURN or signaling service: LAN/loopback feasibility test only.
    const peer = new RTCPeerConnection({ iceServers: [] });
    peerRef.current = peer;
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "closed" || peer.connectionState === "disconnected") {
        setConnected(false);
        setStatus("فُقد الاتصال المباشر؛ لا تُحتسب أي ضغطة جديدة");
      }
    };
    if (mode === "guest") peer.ondatachannel = event => {
      if (event.channel.label !== "quddam-buzzer-poc-v1") { event.channel.close(); return; }
      attachChannel(event.channel, "guest");
    };
    return peer;
  }

  async function beginHost() {
    if (peerRef.current) return;
    setRole("host"); roleRef.current = "host"; setWorking(true);
    try {
      if (typeof RTCPeerConnection === "undefined") throw new Error("هذا المتصفح لا يدعم WebRTC");
      const peer = makePeer("host");
      attachChannel(peer.createDataChannel("quddam-buzzer-poc-v1", { ordered: true }), "host");
      await peer.setLocalDescription(await peer.createOffer());
      await completeIce(peer);
      if (!peer.localDescription) throw new Error("تعذر إنشاء عرض الاتصال");
      setLocalSignal(JSON.stringify({ type: "offer", sdp: peer.localDescription.sdp }));
      setStatus("انسخ العرض إلى الضيف، ثم الصق إجابته في الحقل الثاني");
    } catch (error) { peerRef.current?.close(); fail(error); }
    finally { setWorking(false); }
  }

  async function beginGuest() {
    if (peerRef.current) return;
    setRole("guest"); roleRef.current = "guest"; setStatus("الصق عرض الهوست أدناه ثم اختر إنشاء الإجابة");
  }

  async function acceptOffer() {
    if (roleRef.current !== "guest" || peerRef.current) return;
    setWorking(true);
    try {
      const offer = parseSessionDescription(remoteSignal.trim(), "offer");
      const peer = makePeer("guest");
      await peer.setRemoteDescription(offer);
      await peer.setLocalDescription(await peer.createAnswer());
      await completeIce(peer);
      if (!peer.localDescription) throw new Error("تعذر إنشاء إجابة الاتصال");
      setLocalSignal(JSON.stringify({ type: "answer", sdp: peer.localDescription.sdp }));
      setStatus("انسخ الإجابة إلى الهوست، وانتظر فتح الاتصال");
    } catch (error) { peerRef.current?.close(); fail(error); }
    finally { setWorking(false); }
  }

  async function acceptAnswer() {
    if (roleRef.current !== "host" || !peerRef.current || peerRef.current.remoteDescription) return;
    setWorking(true);
    try {
      await peerRef.current.setRemoteDescription(parseSessionDescription(remoteSignal.trim(), "answer"));
      setStatus("استلمنا إجابة الضيف. بانتظار الاتصال المباشر…");
    } catch (error) { fail(error); }
    finally { setWorking(false); }
  }

  function guestBuzz() {
    if (roleRef.current !== "guest" || channelRef.current?.readyState !== "open" || view.phase !== "open") return;
    channelRef.current.send(JSON.stringify({ type: "BUZZ", round: view.round }));
  }

  async function copySignal() {
    try { await navigator.clipboard.writeText(localSignal); setStatus("نُسخت رسالة الاتصال. شاركها مع اللاعب الموثوق فقط."); }
    catch { setStatus("تعذر النسخ الآلي؛ حدّد النص وانسخه يدويًا."); }
  }

  function reset() {
    channelRef.current?.close(); peerRef.current?.close();
    channelRef.current = null; peerRef.current = null; roleRef.current = null;
    stateRef.current = initialLabState(); setView(stateRef.current);
    setRole(null); setConnected(false); setWorking(false); setLocalSignal(""); setRemoteSignal("");
    setStatus("تم إغلاق الجلسة ومسح الحالة المؤقتة من الواجهة.");
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
        <button type="button" className="btn btn-primary" disabled={role !== null || working} onClick={() => void beginHost()}>أنا الهوست · الفريق A</button>
        <button type="button" className="btn btn-secondary" disabled={role !== null || working} onClick={() => void beginGuest()}>أنا الضيف · الفريق B</button>
        <button type="button" className="btn btn-outline" onClick={reset}>إغلاق وإعادة التجربة</button>
      </div>
      <p role="status" aria-live="polite">{status}</p>
      <p className="muted">ابدأ عبر localhost أو HTTPS. لا توجد خدمة Signaling أو STUN/TURN؛ اختبر على جهاز واحد أو شبكة محلية أولًا. بيانات SDP قد تكشف معلومات اتصال، فلا تنشرها.</p>
    </section>
    {role && <section className="panel" style={{ padding: 24, marginBlock: 16 }}>
      <h2 style={{ fontSize: "1.4rem" }}>2. الربط اليدوي الآمن</h2>
      <p>{role === "host" ? "أرسل العرض إلى الضيف، ثم استلم الإجابة والصقها هنا." : "استلم عرض الهوست والصقه، ثم أنشئ إجابة وأعدها إليه."}</p>
      {localSignal && <div style={{ marginBlock: 12 }}>
        <label htmlFor="lab-local-sdp">رسالتك {role === "host" ? "(Offer)" : "(Answer)"}</label>
        <textarea id="lab-local-sdp" dir="ltr" className="form-input" style={{ width: "100%", minHeight: 110 }} readOnly spellCheck={false} value={localSignal}/>
        <button className="btn btn-secondary" type="button" onClick={() => void copySignal()}>نسخ رسالتي</button>
      </div>}
      <label htmlFor="lab-remote-sdp">رسالة الطرف الآخر {role === "host" ? "(Answer)" : "(Offer)"}</label>
      <textarea id="lab-remote-sdp" dir="ltr" className="form-input" style={{ width: "100%", minHeight: 110 }} spellCheck={false} maxLength={100000} value={remoteSignal} onChange={event => setRemoteSignal(event.target.value)} placeholder="الصق JSON هنا" />
      <button className="btn btn-primary" type="button" disabled={working || !remoteSignal.trim() || connected || (role === "host" ? !localSignal || !!peerRef.current?.remoteDescription : !!peerRef.current)}
        onClick={() => void (role === "host" ? acceptAnswer() : acceptOffer())}>
        {working ? "جاري التجهيز…" : role === "host" ? "تأكيد إجابة الضيف" : "إنشاء الإجابة"}
      </button>
    </section>}
    {role && <section className="panel" style={{ padding: 24, marginBlock: 16 }}>
      <h2 style={{ fontSize: "1.4rem" }}>3. جولة الجرس</h2>
      <p>الاتصال: <strong>{connected ? "متصل" : "غير متصل"}</strong> · الجولة {view.round} · الحالة {view.phase}</p>
      <p>الفريق A (الهوست): <strong>{view.scores[0]}</strong> | الفريق B (الضيف): <strong>{view.scores[1]}</strong></p>
      <p aria-live="polite">{view.phase === "locked" || (view.phase === "result" && view.winner !== null)
        ? `أول ضغطة مقبولة: الفريق ${view.winner === 0 ? "A" : "B"}`
        : view.phase === "open" ? "الجرس مفتوح للفريقين" : "الجرس مغلق"}</p>
      <div className="utility-links">
        {role === "host" ? <>
          <button className="btn btn-primary" disabled={!connected || (view.phase !== "waiting" && view.phase !== "result")} onClick={() => updateHost(openRound)}>فتح جولة</button>
          <button className="btn btn-secondary" disabled={!connected || view.phase !== "open"} onClick={() => updateHost(s => buzz(s, 0, s.round))}>جرس الفريق A</button>
          <button className="btn btn-success" disabled={!connected || view.phase !== "locked"} onClick={() => updateHost(awardPoint)}>احتساب نقطة للفائز</button>
          <button className="btn btn-outline" disabled={!connected || (view.phase !== "open" && view.phase !== "locked")} onClick={() => updateHost(skipRound)}>تجاوز الجولة دون نقطة</button>
        </> : <button className="btn btn-primary" disabled={!connected || view.phase !== "open"} onClick={guestBuzz}>اضغط الجرس · الفريق B</button>}
      </div>
      <p className="muted">الهوست وحده يحتسب النقاط. الأسبقية حسب أول طلب يصل إلى جهازه، لا حسب زمن الضغط الحقيقي. عند إغلاق الهوست تنتهي الجلسة.</p>
    </section>}
  </div>;
}
