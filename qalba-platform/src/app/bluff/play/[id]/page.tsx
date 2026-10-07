import {notFound} from "next/navigation";
import {getBluffView,playerActor} from "@/lib/games/bluff/service";
import {BluffError} from "@/lib/games/bluff/module";
import {BluffPlayer} from "@/components/bluff-player";
export default async function Player({params}:{params:Promise<{id:string}>}){const {id}=await params;let view;try{view=await getBluffView(id,await playerActor(id));}catch(e){if(e instanceof BluffError&&[403,404].includes(e.status))notFound();throw e;}return <BluffPlayer initial={view}/>;}
