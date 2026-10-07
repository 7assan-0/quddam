import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {bluffResponse,privateHeaders} from "@/lib/games/bluff/http";
import {createBluffSession} from "@/lib/games/bluff/service";
import {createSchema} from "@/lib/games/bluff/validation";
export async function POST(request:NextRequest){if(!requireSameOrigin(request))return forbidden();try{const user=await currentUser();if(!user)return forbidden();await parseJson(request,createSchema);return NextResponse.json(await createBluffSession(user.id),{status:201,headers:privateHeaders});}catch(error){return bluffResponse(error);}}
