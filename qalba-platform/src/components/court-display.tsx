/* eslint-disable @next/next/no-img-element -- Generated QR data URLs. */
'use client';
import { Brand } from "./brand";
import type {CourtView} from '@/lib/games/court/service';
import {useCourtLive} from './court-live';
import {CourtStage} from './court-stage';
export function CourtDisplay({initial,token,joinQr}:{initial:CourtView;token:string;joinQr:string}){const{view,remaining,connection}=useCourtLive(initial,'display',token);return <div className="shell court-tv" data-phase={view.phase}><div className="page-title"><Brand/><span className="eyebrow">شاشة العرض</span><h1>المحكمة</h1></div>{connection!=='متصل'&&<p role="status">{connection}</p>}<CourtStage view={view} remaining={remaining}/>{view.phase==='LOBBY'&&<section className="panel court-lobby"><h2>انضموا للمحلفين</h2><strong className="stat" dir="ltr">{view.code}</strong><img src={joinQr} width={200} height={200} alt="رمز انضمام المحلفين"/><ol>{view.participants.map(p=><li key={p.id}>{p.name}</li>)}</ol></section>}</div>;}
