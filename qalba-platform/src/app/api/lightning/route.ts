import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {lightningResponse,privateHeaders} from "@/lib/games/lightning/http";
import {createLightningSession} from "@/lib/games/lightning/service";
import {createSchema} from "@/lib/games/lightning/validation";
export async function POST(request:NextRequest){if(!requireSameOrigin(request))return forbidden();try{const user=await currentUser();if(!user)return forbidden();const input=await parseJson(request,createSchema);return NextResponse.json(await createLightningSession(user.id,input.teams),{status:201,headers:privateHeaders});}catch(e){return lightningResponse(e);}}
