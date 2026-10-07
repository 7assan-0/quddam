import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden} from "@/lib/http";
import {bluffResponse,privateHeaders} from "@/lib/games/bluff/http";
import {getBluffView} from "@/lib/games/bluff/service";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const user=await currentUser();if(!user)return forbidden();const actor={kind:"HOST" as const,id:user.id};return NextResponse.json(await getBluffView(id,actor),{headers:privateHeaders});}catch(error){return bluffResponse(error);}}
