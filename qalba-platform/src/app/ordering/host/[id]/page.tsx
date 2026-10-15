import {requireUser} from "@/lib/auth/session";
import {getOrderingView} from "@/lib/games/ordering/service";
import {OrderingHost} from "@/components/ordering-host";
import { NightReturnLink } from "@/components/night-return-link";
export default async function Page({params}:{params:Promise<{id:string}>}){const user=await requireUser(),{id}=await params;const view=await getOrderingView(id,{kind:"HOST",id:user.id});return <><NightReturnLink ownerId={user.id} game="ordering-challenge" sourceId={id}/><OrderingHost initial={view}/></>;}
