"use client";
import { Brand } from "./brand";
import type {RankedView} from "@/lib/games/ranked/service";
import {useRankedLive} from "./ranked-live";
import {RankedStage} from "./ranked-stage";
export function RankedDisplay({initial,token}:{initial:RankedView;token:string}){const {view,remaining,connection}=useRankedLive(initial,"display",token);return <div className="shell ranked-tv" data-phase={view.phase} aria-label="شاشة عرض توب 100"><div className="page-title"><Brand/><h1>توب 100</h1></div>{connection&&<p role="status">{connection}</p>}<RankedStage view={view} remaining={remaining} tv/></div>;}
