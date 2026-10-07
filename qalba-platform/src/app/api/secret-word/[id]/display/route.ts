import { NextRequest,NextResponse } from "next/server";
import { getForbiddenView } from "@/lib/games/forbidden-word/service";
import { ForbiddenWordError } from "@/lib/games/forbidden-word/module";
import { errorResponse } from "@/lib/http";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{return NextResponse.json(await getForbiddenView((await params).id,{kind:"DISPLAY",token:request.nextUrl.searchParams.get("token")??""}),
    {headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
  }catch(error){if(error instanceof ForbiddenWordError)return NextResponse.json({error:error.message,code:error.code},{status:error.status});return errorResponse(error);}
}

