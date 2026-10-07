import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {rankedResponse,privateHeaders} from "@/lib/games/ranked/http";
import {createRankedSession} from "@/lib/games/ranked/service";
import {createSchema} from "@/lib/games/ranked/validation";
export async function POST(request:NextRequest){if(!requireSameOrigin(request))return forbidden();try{const user=await currentUser();if(!user)return forbidden();const input=await parseJson(request,createSchema);return NextResponse.json(await createRankedSession(user.id,input.teams),{status:201,headers:privateHeaders});}catch(e){return rankedResponse(e);}}
