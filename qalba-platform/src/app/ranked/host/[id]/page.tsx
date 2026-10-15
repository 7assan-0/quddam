import {requireUser} from "@/lib/auth/session";
import {getRankedView} from "@/lib/games/ranked/service";
import {RankedHost} from "@/components/ranked-host";
import { NightReturnLink } from "@/components/night-return-link";
export default async function Page({params}:{params:Promise<{id:string}>}){const user=await requireUser(),{id}=await params;const view=await getRankedView(id,{kind:"HOST",id:user.id});return <><NightReturnLink ownerId={user.id} game="top-list" sourceId={id}/><RankedHost initial={view}/></>;}
