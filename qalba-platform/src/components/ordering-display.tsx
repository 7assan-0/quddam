"use client";
import { Brand } from "./brand";
import type { OrderingView } from "@/lib/games/ordering/service";
import { useOrderingLive } from "./ordering-live";
import { OrderingStage } from "./ordering-stage";
export function OrderingDisplay({ initial, token }: { initial: OrderingView; token: string }) { const { view, remaining, connection } = useOrderingLive(initial, "display", token); return <div className="shell ordering-tv" data-phase={view.phase} aria-label="شاشة عرض رتّبها"><div className="page-title"><Brand/><h1>رتّبها</h1></div>{connection !== "متصل" && <p role="status">{connection}</p>}<OrderingStage view={view} remaining={remaining} /></div>; }
