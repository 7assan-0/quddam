import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { getLetterView } from "@/lib/games/letter-network/service";
import { LetterError } from "@/lib/games/letter-network/module";
import { errorResponse,forbidden } from "@/lib/http";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{const user=await currentUser();if(!user)return forbidden();
    return NextResponse.json(await getLetterView((await params).id,{kind:"HOST",id:user.id}),{headers:{"Cache-Control":"no-store"}});
  }catch(error){if(error instanceof LetterError)return NextResponse.json({error:error.message,code:error.code},{status:error.status});return errorResponse(error);}
}

