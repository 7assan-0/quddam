import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {bluffResponse,privateHeaders} from "@/lib/games/bluff/http";
import {applyBluffCommand,playerActor} from "@/lib/games/bluff/service";
import {commandSchema} from "@/lib/games/bluff/validation";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{const {id}=await params,input=await parseJson(request,commandSchema),isPlayer=["SUBMIT_FAKE","SUBMIT_VOTE"].includes(input.action.type);const user=isPlayer?null:await currentUser();if(!isPlayer&&!user)return forbidden();const actor=isPlayer?await playerActor(id):{kind:"HOST" as const,id:user!.id};return NextResponse.json(await applyBluffCommand(id,actor,input.key,input.expectedVersion,input.action),{headers:privateHeaders});}catch(error){return bluffResponse(error);}}
