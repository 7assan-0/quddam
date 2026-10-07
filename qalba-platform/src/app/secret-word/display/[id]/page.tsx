import { notFound } from "next/navigation";
import { getForbiddenView } from "@/lib/games/forbidden-word/service";
import { ForbiddenWordError } from "@/lib/games/forbidden-word/module";
import { ForbiddenDisplay } from "@/components/forbidden-display";
export default async function ForbiddenDisplayPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){
  const id=(await params).id,token=(await searchParams).token??"";let view;
  try{view=await getForbiddenView(id,{kind:"DISPLAY",token});}catch(error){if(error instanceof ForbiddenWordError&&[403,404].includes(error.status))notFound();throw error;}
  return <ForbiddenDisplay initial={view} token={token}/>;
}

