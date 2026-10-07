import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {courtResponse,privateHeaders} from "@/lib/games/court/http";
import {cookieName,joinCourt} from "@/lib/games/court/service";
import {joinSchema} from "@/lib/games/court/validation";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{const {id}=await params,input=await parseJson(request,joinSchema),user=await currentUser();return NextResponse.json(await joinCourt(id,input.code,input.name,request.cookies.get(cookieName(id))?.value,user?.id),{headers:privateHeaders});}catch(error){return courtResponse(error);}}
