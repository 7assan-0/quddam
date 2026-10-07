import QRCode from "qrcode";
import {notFound} from "next/navigation";
import {CourtError} from "@/lib/games/court/module";
import {CourtDisplay} from "@/components/court-display";
import {getCourtView} from "@/lib/games/court/service";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){const id=(await params).id,token=(await searchParams).token??"";let initial;try{initial=await getCourtView(id,{kind:"DISPLAY",token});}catch(e){if(e instanceof CourtError && [403,404,410].includes(e.status))notFound();throw e;}return <CourtDisplay initial={initial} token={token} joinQr={await QRCode.toDataURL(new URL(`/court/join?code=${initial.code}`,process.env.APP_URL??"http://localhost:3000").href,{width:200,margin:2})}/>;}
