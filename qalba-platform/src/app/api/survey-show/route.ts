import { NextRequest,NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { errorResponse,forbidden,parseJson,requireSameOrigin } from "@/lib/http";
import { createSurveySession } from "@/lib/games/survey-battle/service";
import { setupSchema } from "@/lib/games/survey-battle/validation";
import { SurveyError } from "@/lib/games/survey-battle/module";
export async function POST(request:NextRequest){
  if(!requireSameOrigin(request))return forbidden();
  try{const user=await currentUser();if(!user)return forbidden();
    const input=await parseJson(request,setupSchema);return NextResponse.json(await createSurveySession(user.id,input.names),{status:201});
  }catch(error){if(error instanceof SurveyError)return NextResponse.json({error:error.message,code:error.code},{status:error.status});return errorResponse(error);}
}

