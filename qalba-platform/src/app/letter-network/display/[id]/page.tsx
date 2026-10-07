import { notFound } from "next/navigation";
import { getLetterView } from "@/lib/games/letter-network/service";
import { LetterError } from "@/lib/games/letter-network/module";
import { LetterDisplay } from "@/components/letter-display";
export default async function LetterDisplayPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){
  const id=(await params).id,token=(await searchParams).token??"";let view;
  try{view=await getLetterView(id,{kind:"DISPLAY",token});}catch(error){if(error instanceof LetterError&&[403,404].includes(error.status))notFound();throw error;}
  return <LetterDisplay initial={view} token={token}/>;
}

