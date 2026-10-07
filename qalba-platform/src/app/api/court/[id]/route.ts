import {NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden} from "@/lib/http";
import {courtResponse,privateHeaders} from "@/lib/games/court/http";
import {getCourtView} from "@/lib/games/court/service";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const user=await currentUser();if(!user)return forbidden();return NextResponse.json(await getCourtView((await params).id,{kind:"HOST",id:user.id}),{headers:privateHeaders});}catch(e){return courtResponse(e);}}
