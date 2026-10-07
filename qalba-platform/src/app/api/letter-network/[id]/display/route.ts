import { NextRequest,NextResponse } from "next/server";
import { getLetterView } from "@/lib/games/letter-network/service";
import { LetterError } from "@/lib/games/letter-network/module";
import { errorResponse } from "@/lib/http";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{return NextResponse.json(await getLetterView((await params).id,{kind:"DISPLAY",token:request.nextUrl.searchParams.get("token")??""}),
    {headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
  }catch(error){if(error instanceof LetterError)return NextResponse.json({error:error.message,code:error.code},{status:error.status});return errorResponse(error);}
}

