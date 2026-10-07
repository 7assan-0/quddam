import { notFound } from "next/navigation";
import { getForbiddenView } from "@/lib/games/forbidden-word/service";
import { ForbiddenWordError } from "@/lib/games/forbidden-word/module";
import { ForbiddenClue } from "@/components/forbidden-clue";
export default async function ForbiddenCluePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){
  const id=(await params).id,token=(await searchParams).token??"";let view;
  try{view=await getForbiddenView(id,{kind:"CLUE",token});}catch(error){if(error instanceof ForbiddenWordError&&[403,404].includes(error.status))notFound();throw error;}
  return <ForbiddenClue initial={view} token={token}/>;
}

