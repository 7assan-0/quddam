"use client";
import { Brand } from "./brand";
import type { LightningView } from "@/lib/games/lightning/service";
import { useLightningLive } from "./lightning-live";
import { LightningStage } from "./lightning-stage";
export function LightningDisplay({ initial, token }: { initial: LightningView; token: string }) { const { view, remaining, connection } = useLightningLive(initial, "display", token); return <div className="shell lightning-tv" data-phase={view.phase} aria-label="شاشة عرض البرق"><div className="page-title"><Brand/><h1>البرق ⚡</h1></div>{connection !== "متصل" && <p role="status">{connection}</p>}<LightningStage view={view} remaining={remaining} tv /></div>; }
