"use client";
import { connectLive } from "@/lib/realtime/client";
import { useState, useEffect, useRef } from "react";
import type { LightningView } from "@/lib/games/lightning/service";
import type { HostAction } from "@/lib/games/lightning/module";
export function useLightningLive(initial: LightningView, audience: "host" | "display" | "buzzer", token?: string) {
  const [view, setView] = useState(initial), [error, setError] = useState(""), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [connection, setConnection] = useState("جاري الاتصال…"), [tick, setTick] = useState(0);
  const version = useRef(initial.version), anchor = useRef({ server: Date.parse(initial.serverNow), local: 0 }), pending = useRef<{ payload: string; key: string; version: number } | null>(null);
  const endpoint = `/api/lightning/${initial.id}${audience === "host" ? "" : `/${audience}?token=${encodeURIComponent(token ?? "")}`}`;
  useEffect(() => {
    let alive = true;
    anchor.current = { server: Date.parse(initial.serverNow), local: performance.now() };
    const live = connectLive<LightningView>({
      events: `/api/lightning/${initial.id}/events?audience=${audience}${audience === "host" ? "" : `&token=${encodeURIComponent(token ?? "")}`}`,
      endpoint, now: () => performance.now(),
      apply: (next, sent) => { if (!alive || next.version < version.current) return; version.current = next.version; setView(next); const received = performance.now(); anchor.current = { server: Date.parse(next.serverNow) + (received - sent) / 2, local: received }; setReady(true); setConnection("متصل"); },
      temporary: () => { if (alive) { setReady(false); setConnection("إعادة الاتصال…"); } },
      terminal: () => { if (alive) { setReady(false); setConnection("انتهى الوصول إلى المباراة أو الرابط."); setView(current => ({ ...current, privateAnswer: null, question: null, revealedAnswer: null, canBuzz: false, canUndo: false, canVoid: false })); } },
    });
    const timer = setInterval(() => setTick(anchor.current.server + Math.max(0, performance.now() - anchor.current.local)), 100);
    return () => { alive = false; live.close(); clearInterval(timer); };
  }, [initial.id, initial.serverNow, audience, token, endpoint]);
  async function send(action: HostAction | { type: "BUZZ" }) {
    if (busy || audience === "display" || (audience === "buzzer" && action.type !== "BUZZ")) return false;
    setBusy(true); setError(""); const payload = JSON.stringify(action);
    // Retry a lost response at the same authoritative version with the same key.
    // A later state/question is a new attempt, even when its action is also BUZZ.
    if (pending.current?.payload !== payload || pending.current.version !== view.version) pending.current = { payload, key: crypto.randomUUID(), version: view.version };
    try {
      const sent = performance.now(), r = await fetch(`/api/lightning/${view.id}/${audience === "buzzer" ? "buzzer" : "commands"}`, { method: "POST", headers: { "Content-Type": "application/json", ...(audience === "buzzer" ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ key: pending.current.key, expectedVersion: view.version, ...(audience === "host" ? { action } : {}) }) }), data = await r.json();
      if (!r.ok) { pending.current = null; const refreshed = await fetch(endpoint, { cache: "no-store" }); if (refreshed.ok) { const next = await refreshed.json() as LightningView; if (next.version >= version.current) { version.current = next.version; setView(next); anchor.current = { server: Date.parse(next.serverNow), local: performance.now() }; } } throw new Error(data.error ?? "تعذر الإجراء"); }
      if (data.session.version >= version.current) { version.current = data.session.version; setView(data.session); anchor.current = { server: Date.parse(data.session.serverNow) + (performance.now() - sent) / 2, local: performance.now() }; }
      pending.current = null; return true;
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر الاتصال"); return false; } finally { setBusy(false); }
  }
  const serverNow = tick || Date.parse(view.serverNow), remaining = view.phase === "PAUSED" ? view.remainingMs ?? 0 : view.deadlineAt ? Math.max(0, Date.parse(view.deadlineAt) - serverNow) : 0;
  return { view, error, busy, ready, connection, send, remaining };
}
