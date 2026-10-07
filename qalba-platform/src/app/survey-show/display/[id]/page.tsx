import { notFound } from "next/navigation";
import { getSurveyView } from "@/lib/games/survey-battle/service";
import { SurveyError } from "@/lib/games/survey-battle/module";
import { SurveyDisplay } from "@/components/survey-display";
export default async function SurveyDisplayPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){
  const id=(await params).id,token=(await searchParams).token??"";let view;
  try{view=await getSurveyView(id,{kind:"DISPLAY",token});}catch(error){if(error instanceof SurveyError&&[403,404].includes(error.status))notFound();throw error;}
  return <SurveyDisplay initial={view} token={token}/>;
}

