import {NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden} from "@/lib/http";
import {rankedResponse,privateHeaders} from "@/lib/games/ranked/http";
import {getRankedView} from "@/lib/games/ranked/service";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const user=await currentUser();if(!user)return forbidden();return NextResponse.json(await getRankedView((await params).id,{kind:"HOST",id:user.id}),{headers:privateHeaders});}catch(e){return rankedResponse(e);}}
