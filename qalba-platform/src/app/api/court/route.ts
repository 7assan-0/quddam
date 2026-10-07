import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {courtResponse,privateHeaders} from "@/lib/games/court/http";
import {createCourtSession} from "@/lib/games/court/service";
import {createSchema} from "@/lib/games/court/validation";
export async function POST(request:NextRequest){if(!requireSameOrigin(request))return forbidden();try{const user=await currentUser();if(!user)return forbidden();const input=await parseJson(request,createSchema);return NextResponse.json(await createCourtSession(user.id,input.teams),{status:201,headers:privateHeaders});}catch(e){return courtResponse(e);}}
