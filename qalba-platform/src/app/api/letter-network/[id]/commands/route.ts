import { NextRequest,NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { applyLetterCommand } from "@/lib/games/letter-network/service";
import { commandSchema } from "@/lib/games/letter-network/validation";
import { LetterError } from "@/lib/games/letter-network/module";
import { CreditError } from "@/lib/billing/credits";
import { errorResponse,forbidden,parseJson,requireSameOrigin } from "@/lib/http";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!requireSameOrigin(request))return forbidden();
  try{const user=await currentUser();if(!user)return forbidden();const input=await parseJson(request,commandSchema);
    return NextResponse.json(await applyLetterCommand((await params).id,user.id,input.key,input.expectedVersion,input.action));
  }catch(error){if(error instanceof LetterError)return NextResponse.json({error:error.message,code:error.code},{status:error.status});
    if(error instanceof CreditError)return NextResponse.json({error:error.message},{status:error.status});return errorResponse(error);}
}

