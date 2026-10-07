import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,requireSameOrigin} from "@/lib/http";
import {bluffResponse,privateHeaders} from "@/lib/games/bluff/http";
import QRCode from "qrcode";
import {createBluffDisplayAccess,revokeBluffDisplayAccess} from "@/lib/games/bluff/service";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{const user=await currentUser();if(!user)return forbidden();const {id}=await params,access=await createBluffDisplayAccess(user.id,id),url=new URL(`/bluff/display/${id}?token=${access.token}`,process.env.APP_URL??request.nextUrl.origin).href;return NextResponse.json({url,expiresAt:access.expiresAt,qr:await QRCode.toDataURL(url,{width:180,margin:2})},{headers:privateHeaders});}catch(error){return bluffResponse(error);}}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{const user=await currentUser();if(!user)return forbidden();await revokeBluffDisplayAccess(user.id,(await params).id);return NextResponse.json({revoked:true},{headers:privateHeaders});}catch(error){return bluffResponse(error);}}
