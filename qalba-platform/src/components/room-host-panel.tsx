"use client";
import { connectLive } from "@/lib/realtime/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { roomView } from "@/lib/rooms/service";
import { acceptsRoomView } from "./room-view-order";
type View = Awaited<ReturnType<typeof roomView>>;
export function RoomHostPanel({ sessionId }: { sessionId: string }) {
  const [code, setCode] = useState(""); const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    let cancelled = false;
    // The room is persisted independently of this component. Restore its code
    // through the existing owner-gated endpoint after refresh/session recovery.
    fetch(`/api/rooms/by-session/${encodeURIComponent(sessionId)}`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("restore-failed");
        const result = await response.json() as { code: string | null };
        if (!cancelled && result.code) setCode(result.code);
      })
      .catch(() => { if (!cancelled) setError("تعذّر استعادة الغرفة. حاول فتحها مجددًا."); })
      .finally(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
  }, [sessionId]);
  useEffect(() => { if (!code) return;
    const live = connectLive<View>({ events: `/api/rooms/${code}/events`, endpoint: `/api/rooms/${code}`,
      apply: next => setView(current => next.code !== code || next.session.id !== sessionId || !next.host
        ? current : current === null || acceptsRoomView(current, next) ? next : current),
      temporary: () => {}, terminal: () => setView(null),
    });
    return () => live.close();
  }, [code, sessionId]);
  async function create() { setBusy(true); setError(""); try { const response = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error); setCode(result.code);
  } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر إنشاء الغرفة"); } finally { setBusy(false); } }
  return <section className="panel room-host"><span className="eyebrow">لعب الجوالات</span><h2>افتحوا الغرفة</h2>
    {code ? <><p>أرسل الرمز أو الرابط للاعبين. يمكنهم الانضمام دون حساب.</p><strong className="room-code" dir="ltr">{code}</strong><div className="host-actions"><Link className="btn btn-secondary" href={`/join?code=${code}`}>رابط الانضمام</Link><Link className="btn btn-secondary" href={`/rooms/${code}`} target="_blank">ردهة الغرفة</Link></div>
      <p>{view?.participants.length ?? 0} لاعب في الغرفة · {view?.participants.filter((person) => person.ready).length ?? 0} جاهزون</p>
      {view?.responses && view.responses.length > 0 && <div><h3>إجابات السؤال</h3>{view.responses.map((item, index) => <p key={index}>{item.name}: {String((item.response as { text?: string }).text ?? "")}</p>)}</div>}</>
      : <button className="btn btn-secondary" onClick={create} disabled={busy || restoring}>{restoring ? "جارٍ استعادة الغرفة..." : busy ? "جارٍ الفتح..." : "أنشئ غرفة برمز"}</button>}
    {error && <p role="alert" className="form-error">{error}</p>}</section>;
}
