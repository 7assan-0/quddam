"use client";
import { connectLive } from "@/lib/realtime/client";
import { useState, useEffect, useRef } from "react";
import type { OrderingView } from "@/lib/games/ordering/service";
import type { HostAction, TeamAction } from "@/lib/games/ordering/module";
export function useOrderingLive(initial: OrderingView, audience: "host" | "display" | "controller", token?: string) {
  const [view, setView] = useState(initial), [error, setError] = useState(""), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [connection, setConnection] = useState("جاري الاتصال…"), [tick, setTick] = useState(0);
  const version = useRef(initial.version), anchor = useRef({ server: Date.parse(initial.serverNow), local: 0 }), pending = useRef<{ payload: string; key: string; version: number } | null>(null);
  const endpoint = `/api/ordering/${initial.id}${audience === "host" ? "" : `/${audience}?token=${encodeURIComponent(token ?? "")}`}`;
  useEffect(() => {
    let alive = true;
    anchor.current = { server: Date.parse(initial.serverNow), local: performance.now() };
    const live = connectLive<OrderingView>({
      events: `/api/ordering/${initial.id}/events?audience=${audience}${audience === "host" ? "" : `&token=${encodeURIComponent(token ?? "")}`}`,
      endpoint, now: () => performance.now(),
      apply: (next, sent) => { if (!alive || next.version < version.current) return; version.current = next.version; setView(next); const received = performance.now(); anchor.current = { server: Date.parse(next.serverNow) + (received - sent) / 2, local: received }; setReady(true); setConnection("متصل"); },
      temporary: () => { if (alive) { setReady(false); setConnection("إعادة الاتصال…"); } },
      terminal: () => { if (alive) { setReady(false); setConnection("انتهى الوصول إلى المباراة أو الرابط."); setView(current => ({ ...current, privateOrder: undefined, question: null, reveal: null, canOrder: false })); } },
    });
    const timer = setInterval(() => setTick(anchor.current.server + Math.max(0, performance.now() - anchor.current.local)), 100);
    return () => { alive = false; live.close(); clearInterval(timer); };
  }, [initial.id, initial.serverNow, audience, token, endpoint]);
  async function send(action: HostAction | TeamAction) {
    if (busy || audience === "display" || (audience === "controller" && !["SAVE_ORDER", "SUBMIT_ORDER"].includes(action.type))) return false;
    setBusy(true); setError(""); const payload = JSON.stringify(action), retryVersion = audience === "controller" ? view.revision! : view.version;
    // Retry a lost response at the same authoritative version with the same key.
    // A new own revision or round is a new command, never a retry of prior input.
    if (pending.current?.payload !== payload || pending.current.version !== retryVersion) pending.current = { payload, key: crypto.randomUUID(), version: retryVersion };
    try {
      const sent = performance.now(), r = await fetch(`/api/ordering/${view.id}/${audience === "controller" ? "controller" : "commands"}`, { method: "POST", headers: { "Content-Type": "application/json", ...(audience === "controller" ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ key: pending.current.key, ...(audience === "host" ? { expectedVersion: view.version } : { expectedRevision: view.revision }), action }) }), data = await r.json();
      if (!r.ok) { pending.current = null; const refreshed = await fetch(endpoint, { cache: "no-store" }); if (refreshed.ok) { const next = await refreshed.json() as OrderingView; if (next.version >= version.current) { version.current = next.version; setView(next); anchor.current = { server: Date.parse(next.serverNow), local: performance.now() }; } } throw new Error(data.error ?? "تعذر الإجراء"); }
      if (data.session.version >= version.current) { version.current = data.session.version; setView(data.session); anchor.current = { server: Date.parse(data.session.serverNow) + (performance.now() - sent) / 2, local: performance.now() }; }
      pending.current = null; return true;
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر الاتصال"); return false; } finally { setBusy(false); }
  }
  const serverNow = tick || Date.parse(view.serverNow), remaining = view.phase === "PAUSED" ? view.remainingMs ?? 0 : view.deadlineAt ? Math.max(0, Date.parse(view.deadlineAt) - serverNow) : 0;
  return { view, error, busy, ready, connection, send, remaining };
}
