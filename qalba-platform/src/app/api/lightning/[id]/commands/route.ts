import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {lightningResponse,privateHeaders} from "@/lib/games/lightning/http";
import {applyLightningCommand} from "@/lib/games/lightning/service";
import {commandSchema} from "@/lib/games/lightning/validation";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{const user=await currentUser();if(!user)return forbidden();const input=await parseJson(request,commandSchema);return NextResponse.json(await applyLightningCommand((await params).id,user.id,input.key,input.expectedVersion,input.action),{headers:privateHeaders});}catch(e){return lightningResponse(e);}}
