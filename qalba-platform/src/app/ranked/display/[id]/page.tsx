import {notFound} from "next/navigation";
import {RankedError} from "@/lib/games/ranked/module";
import {RankedDisplay} from "@/components/ranked-display";
import {getRankedView} from "@/lib/games/ranked/service";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){const id=(await params).id,token=(await searchParams).token??"";let initial;try{initial=await getRankedView(id,{kind:"DISPLAY",token});}catch(e){if(e instanceof RankedError && [403,404,410].includes(e.status))notFound();throw e;}return <RankedDisplay initial={initial} token={token}/>;}
