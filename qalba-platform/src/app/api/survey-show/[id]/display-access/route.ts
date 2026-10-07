import { NextRequest,NextResponse } from "next/server";
import QRCode from "qrcode";
import { currentUser } from "@/lib/auth/session";
import { createSurveyDisplayAccess,revokeSurveyDisplayAccess } from "@/lib/games/survey-battle/service";
import { SurveyError } from "@/lib/games/survey-battle/module";
import { errorResponse,forbidden,requireSameOrigin } from "@/lib/http";
const headers={"Cache-Control":"no-store","Referrer-Policy":"no-referrer"};
async function handle(request:NextRequest,id:string,revoke:boolean){
  if(!requireSameOrigin(request))return forbidden();
  try{const user=await currentUser();if(!user)return forbidden();
    if(revoke){await revokeSurveyDisplayAccess(user.id,id);return NextResponse.json({revoked:true},{headers});}
    const access=await createSurveyDisplayAccess(user.id,id);
    const url="/survey-show/display/"+id+"?token="+encodeURIComponent(access.token);
    const origin=process.env.APP_URL?new URL(process.env.APP_URL).origin:request.nextUrl.origin;
    const qrDataUrl=await QRCode.toDataURL(new URL(url,origin).href,{width:256,margin:2});
    return NextResponse.json({url,qrDataUrl,expiresAt:access.expiresAt},{headers});
  }catch(error){if(error instanceof SurveyError)return NextResponse.json({error:error.message,code:error.code},{status:error.status,headers});return errorResponse(error);}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handle(request,(await params).id,false);}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handle(request,(await params).id,true);}

