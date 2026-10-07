import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {rankedResponse,privateHeaders} from "@/lib/games/ranked/http";
import {applyRankedCommand} from "@/lib/games/ranked/service";
import {commandSchema} from "@/lib/games/ranked/validation";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{const user=await currentUser();if(!user)return forbidden();const input=await parseJson(request,commandSchema);return NextResponse.json(await applyRankedCommand((await params).id,user.id,input.key,input.expectedVersion,input.action),{headers:privateHeaders});}catch(e){return rankedResponse(e);}}
