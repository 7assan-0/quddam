import { NextRequest,NextResponse } from "next/server";
import QRCode from "qrcode";
import { currentUser } from "@/lib/auth/session";
import { createLetterDisplayAccess,revokeLetterDisplayAccess } from "@/lib/games/letter-network/service";
import { LetterError } from "@/lib/games/letter-network/module";
import { errorResponse,forbidden,requireSameOrigin } from "@/lib/http";
const headers={"Cache-Control":"no-store","Referrer-Policy":"no-referrer"};
async function handle(request:NextRequest,id:string,revoke:boolean){
  if(!requireSameOrigin(request))return forbidden();
  try{const user=await currentUser();if(!user)return forbidden();
    if(revoke){await revokeLetterDisplayAccess(user.id,id);return NextResponse.json({revoked:true},{headers});}
    const access=await createLetterDisplayAccess(user.id,id);
    const url="/letter-network/display/"+id+"?token="+encodeURIComponent(access.token);
    const origin=process.env.APP_URL?new URL(process.env.APP_URL).origin:request.nextUrl.origin;
    const qrDataUrl=await QRCode.toDataURL(new URL(url,origin).href,{width:256,margin:2});
    return NextResponse.json({url,qrDataUrl,expiresAt:access.expiresAt},{headers});
  }catch(error){if(error instanceof LetterError)return NextResponse.json({error:error.message,code:error.code},{status:error.status,headers});return errorResponse(error);}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handle(request,(await params).id,false);}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handle(request,(await params).id,true);}

