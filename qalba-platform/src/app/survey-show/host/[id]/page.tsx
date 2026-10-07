import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getSurveyView } from "@/lib/games/survey-battle/service";
import { SurveyError } from "@/lib/games/survey-battle/module";
import { SurveyHost } from "@/components/survey-host";
export default async function SurveyHostPage({params}:{params:Promise<{id:string}>}){
  const user=await requireUser();let view;
  try{view=await getSurveyView((await params).id,{kind:"HOST",id:user.id});}catch(error){if(error instanceof SurveyError&&[403,404].includes(error.status))notFound();throw error;}
  return <SurveyHost initial={view}/>;
}

