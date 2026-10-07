import {notFound} from "next/navigation";
import {OrderingError} from "@/lib/games/ordering/module";
import {OrderingDisplay} from "@/components/ordering-display";
import {getOrderingView} from "@/lib/games/ordering/service";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){const id=(await params).id,token=(await searchParams).token??"";let initial;try{initial=await getOrderingView(id,{kind:"DISPLAY",token});}catch(e){if(e instanceof OrderingError && [403,404,410].includes(e.status))notFound();throw e;}return <OrderingDisplay initial={initial} token={token}/>;}
