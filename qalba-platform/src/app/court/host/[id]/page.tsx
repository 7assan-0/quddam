import QRCode from "qrcode";
import {requireUser} from "@/lib/auth/session";
import {getCourtView} from "@/lib/games/court/service";
import {CourtHost} from "@/components/court-host";
export default async function Page({params}:{params:Promise<{id:string}>}){const user=await requireUser(),initial=await getCourtView((await params).id,{kind:"HOST",id:user.id}),joinUrl=new URL(`/court/join?code=${initial.code}`,process.env.APP_URL??"http://localhost:3000").href;return <CourtHost initial={initial} joinUrl={joinUrl} joinQr={await QRCode.toDataURL(joinUrl,{width:180,margin:2})}/>;}
