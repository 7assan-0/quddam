import { NextRequest,NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { applySurveyCommand } from "@/lib/games/survey-battle/service";
import { commandSchema } from "@/lib/games/survey-battle/validation";
import { SurveyError } from "@/lib/games/survey-battle/module";
import { CreditError } from "@/lib/billing/credits";
import { errorResponse,forbidden,parseJson,requireSameOrigin } from "@/lib/http";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!requireSameOrigin(request))return forbidden();
  try{const user=await currentUser();if(!user)return forbidden();const input=await parseJson(request,commandSchema);
    return NextResponse.json(await applySurveyCommand((await params).id,user.id,input.key,input.expectedVersion,input.action));
  }catch(error){if(error instanceof SurveyError)return NextResponse.json({error:error.message,code:error.code},{status:error.status});
    if(error instanceof CreditError)return NextResponse.json({error:error.message},{status:error.status});return errorResponse(error);}
}

