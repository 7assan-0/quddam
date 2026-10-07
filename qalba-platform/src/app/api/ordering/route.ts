import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {orderingResponse,privateHeaders} from "@/lib/games/ordering/http";
import {createOrderingSession} from "@/lib/games/ordering/service";
import {createSchema} from "@/lib/games/ordering/validation";
export async function POST(request:NextRequest){if(!requireSameOrigin(request))return forbidden();try{const user=await currentUser();if(!user)return forbidden();const input=await parseJson(request,createSchema);return NextResponse.json(await createOrderingSession(user.id,input.teams),{status:201,headers:privateHeaders});}catch(e){return orderingResponse(e);}}
