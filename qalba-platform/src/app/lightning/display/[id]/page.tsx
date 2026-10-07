import {notFound} from "next/navigation";
import {LightningError} from "@/lib/games/lightning/module";
import {LightningDisplay} from "@/components/lightning-display";
import {getLightningView} from "@/lib/games/lightning/service";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){const id=(await params).id,token=(await searchParams).token??"";let initial;try{initial=await getLightningView(id,{kind:"DISPLAY",token});}catch(e){if(e instanceof LightningError && [403,404,410].includes(e.status))notFound();throw e;}return <LightningDisplay initial={initial} token={token}/>;}
