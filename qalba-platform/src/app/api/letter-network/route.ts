import { NextRequest,NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { errorResponse,forbidden,parseJson,requireSameOrigin } from "@/lib/http";
import { createLetterSession } from "@/lib/games/letter-network/service";
import { setupSchema } from "@/lib/games/letter-network/validation";
import { LetterError } from "@/lib/games/letter-network/module";
export async function POST(request:NextRequest){
  if(!requireSameOrigin(request))return forbidden();
  try{const user=await currentUser();if(!user)return forbidden();
    const input=await parseJson(request,setupSchema);return NextResponse.json(await createLetterSession(user.id,input.names),{status:201});
  }catch(error){if(error instanceof LetterError)return NextResponse.json({error:error.message,code:error.code},{status:error.status});return errorResponse(error);}
}

