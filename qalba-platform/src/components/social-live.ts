"use client";
import { connectLive } from "@/lib/realtime/client";
import { useEffect, useRef, useState } from "react";
import type { SocialAction, SocialView } from "@/lib/games/social-deduction/service";
import { sameVoteBoundary } from "@/lib/games/social-deduction/vote-intent";
export type Audience = "host" | "player" | "display";
export function useSocialLive(initial: SocialView, audience: Audience, token?: string) {
  const [view, setView] = useState(initial); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState(""); const [clock, setClock] = useState(0);
  const [offset, setOffset] = useState(() => new Date(initial.serverNow).getTime() - Date.now());
  const version = useRef(initial.version);
  useEffect(() => {
    let alive = true;
    const query = audience === "display" ? `audience=display&token=${encodeURIComponent(token ?? "")}` : `audience=${audience}`;
    const endpoint = audience === "host" ? `/api/social/${initial.id}` : audience === "player" ? `/api/social/${initial.id}/player` : `/api/social/${initial.id}/display?token=${encodeURIComponent(token ?? "")}`;
    const live = connectLive<SocialView>({
      events: `/api/social/${initial.id}/events?${query}`, endpoint,
      apply: (next, sentAt) => { if (!alive || next.version < version.current) return; setOffset(Date.parse(next.serverNow) - (sentAt + Date.now()) / 2); version.current = next.version; setView(next); setConnection(""); },
      temporary: () => { if (alive) setConnection("جارٍ إعادة الاتصال…"); },
      terminal: () => { if (alive) { setConnection("انتهى الوصول إلى العرض أو الغرفة."); setView(current => ({ ...current, self: current.self ? { ...current.self, secretWord: null, role: null, votedFor: null } : null, reveal: null, tally: null })); } },
    });
    const tick = setInterval(() => setClock(Date.now()), 250);
    return () => { alive = false; live.close(); clearInterval(tick); };
  }, [initial.id, audience, token]);
  async function send(action: SocialAction) { if (busy) return false; setBusy(true); setError("");
    try {
      const key = crypto.randomUUID(); let expectedVersion = view.version;
      for (let attempt = 0; attempt < 5; attempt++) {
        const response = await fetch(`/api/social/${view.id}/commands`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, expectedVersion, action }) });
        const data = await response.json();
        if (response.ok) { if (data.session.version >= version.current) { version.current = data.session.version; setView(data.session); }
          setOffset(new Date(data.session.serverNow).getTime() - Date.now()); return true; }
        if (!["STALE_GAME_STATE", "STALE_ROUND", "STALE_VOTE_INTENT"].includes(data.code)) throw new Error(data.error ?? "تعذّر تنفيذ الإجراء");
        const endpoint = audience === "host" ? `/api/social/${view.id}` : `/api/social/${view.id}/player`;
        const current = await fetch(endpoint, { cache: "no-store" });
        if (!current.ok) throw new Error(data.error ?? "تعذّر تحديث المباراة");
        const fresh = await current.json() as SocialView;
        if (fresh.version >= version.current) { version.current = fresh.version; setView(fresh); }
        if (data.code !== "STALE_GAME_STATE") throw new Error(data.error ?? "تغيرت الجولة. اختر صوتك من جديد");
        const compatibleVote = action.type === "SUBMIT_VOTE" && sameVoteBoundary(action, view.phase, fresh);
        const compatibleStart = action.type === "START" && view.phase === "LOBBY" && fresh.phase === "LOBBY";
        const compatibleRemoval = action.type === "REMOVE_PARTICIPANT" && fresh.phase === "LOBBY" && fresh.participants.some(p => p.id === action.targetId);
        if (!compatibleVote && !compatibleStart && !compatibleRemoval) throw new Error(data.error ?? "تغيرت المباراة");
        expectedVersion = fresh.version;
      }
      throw new Error("تزامنت أصوات كثيرة. حاول مرة أخرى.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر تنفيذ الإجراء"); return false; }
    finally { setBusy(false); }
  }
  const seconds = view.deadlineAt ? Math.max(0, Math.ceil((new Date(view.deadlineAt).getTime() - (clock || new Date(view.serverNow).getTime() - offset) - offset) / 1000)) : Math.ceil(view.remainingMs / 1000);
  return { view, error, setError, busy, connection, seconds, send, setView };
}
