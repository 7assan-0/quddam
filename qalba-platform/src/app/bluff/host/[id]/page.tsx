import {notFound} from "next/navigation";
import QRCode from "qrcode";
import {requireUser} from "@/lib/auth/session";
import {getBluffView} from "@/lib/games/bluff/service";
import {BluffError} from "@/lib/games/bluff/module";
import {BluffHost} from "@/components/bluff-host";
export default async function Host({params}:{params:Promise<{id:string}>}){const user=await requireUser();let view;try{view=await getBluffView((await params).id,{kind:"HOST",id:user.id});}catch(e){if(e instanceof BluffError&&[403,404].includes(e.status))notFound();throw e;}const url=new URL(`/bluff/join?code=${view.code}`,process.env.APP_URL??"http://localhost:3000").href;return <BluffHost initial={view} joinQr={await QRCode.toDataURL(url,{width:200,margin:2})}/>;}
