import {NextRequest,NextResponse} from "next/server";


import {bluffResponse,privateHeaders} from "@/lib/games/bluff/http";
import {getBluffView,playerActor} from "@/lib/games/bluff/service";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const actor=await playerActor(id);return NextResponse.json(await getBluffView(id,actor),{headers:privateHeaders});}catch(error){return bluffResponse(error);}}
