import { NextRequest,NextResponse } from "next/server";
import { getSurveyView } from "@/lib/games/survey-battle/service";
import { SurveyError } from "@/lib/games/survey-battle/module";
import { errorResponse } from "@/lib/http";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{return NextResponse.json(await getSurveyView((await params).id,{kind:"DISPLAY",token:request.nextUrl.searchParams.get("token")??""}),
    {headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
  }catch(error){if(error instanceof SurveyError)return NextResponse.json({error:error.message,code:error.code},{status:error.status});return errorResponse(error);}
}

