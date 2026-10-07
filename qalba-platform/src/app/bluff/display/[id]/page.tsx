import {notFound} from "next/navigation";
import QRCode from "qrcode";
import {getBluffView} from "@/lib/games/bluff/service";
import {BluffError} from "@/lib/games/bluff/module";
import {BluffDisplay} from "@/components/bluff-display";
export default async function Display({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){const {id}=await params,token=(await searchParams).token??"";let view;try{view=await getBluffView(id,{kind:"DISPLAY",token});}catch(e){if(e instanceof BluffError&&[403,404].includes(e.status))notFound();throw e;}const url=new URL(`/bluff/join?code=${view.code}`,process.env.APP_URL??"http://localhost:3000").href;return <BluffDisplay initial={view} token={token} joinQr={await QRCode.toDataURL(url,{width:200,margin:2})}/>;}
