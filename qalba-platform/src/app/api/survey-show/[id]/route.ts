import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { getSurveyView } from "@/lib/games/survey-battle/service";
import { SurveyError } from "@/lib/games/survey-battle/module";
import { errorResponse,forbidden } from "@/lib/http";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{const user=await currentUser();if(!user)return forbidden();
    return NextResponse.json(await getSurveyView((await params).id,{kind:"HOST",id:user.id}),{headers:{"Cache-Control":"no-store"}});
  }catch(error){if(error instanceof SurveyError)return NextResponse.json({error:error.message,code:error.code},{status:error.status});return errorResponse(error);}
}

