import {notFound} from "next/navigation";
import {getCourtView,jurorActor} from "@/lib/games/court/service";
import {CourtError} from "@/lib/games/court/module";
import {CourtJuror} from "@/components/court-juror";
export default async function Player({params}:{params:Promise<{id:string}>}){const {id}=await params;let view;try{view=await getCourtView(id,await jurorActor(id));}catch(e){if(e instanceof CourtError&&[403,404].includes(e.status))notFound();throw e;}return <CourtJuror initial={view}/>;}
