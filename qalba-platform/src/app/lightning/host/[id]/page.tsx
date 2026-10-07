import {requireUser} from "@/lib/auth/session";
import {getLightningView} from "@/lib/games/lightning/service";
import {LightningHost} from "@/components/lightning-host";
export default async function Page({params}:{params:Promise<{id:string}>}){const user=await requireUser();return <LightningHost initial={await getLightningView((await params).id,{kind:"HOST",id:user.id})}/>;}
