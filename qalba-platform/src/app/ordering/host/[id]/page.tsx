import {requireUser} from "@/lib/auth/session";
import {getOrderingView} from "@/lib/games/ordering/service";
import {OrderingHost} from "@/components/ordering-host";
export default async function Page({params}:{params:Promise<{id:string}>}){const user=await requireUser();return <OrderingHost initial={await getOrderingView((await params).id,{kind:"HOST",id:user.id})}/>;}
