import {requireUser} from "@/lib/auth/session";
import {getRankedView} from "@/lib/games/ranked/service";
import {RankedHost} from "@/components/ranked-host";
export default async function Page({params}:{params:Promise<{id:string}>}){const user=await requireUser();return <RankedHost initial={await getRankedView((await params).id,{kind:"HOST",id:user.id})}/>;}
