import {NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden} from "@/lib/http";
import {lightningResponse,privateHeaders} from "@/lib/games/lightning/http";
import {getLightningView} from "@/lib/games/lightning/service";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const user=await currentUser();if(!user)return forbidden();return NextResponse.json(await getLightningView((await params).id,{kind:"HOST",id:user.id}),{headers:privateHeaders});}catch(e){return lightningResponse(e);}}
