"use client";
import { Brand } from "./brand";
import type {BluffView} from "@/lib/games/bluff/service";
import {useBluffLive} from "./bluff-live";
import {BluffStage} from "./bluff-stage";
export function BluffDisplay({initial,token,joinQr}:{initial:BluffView;token:string;joinQr:string}){const {view,remaining,connection}=useBluffLive(initial,"display",token);return <div className="shell bluff-tv" aria-label="شاشة عرض صدّقني" data-phase={view.phase}><div className="page-title"><Brand/><h1>صدّقني</h1></div>{connection&&<p role="status">{connection}</p>}<BluffStage view={view} remaining={remaining} joinQr={joinQr}/></div>;}
