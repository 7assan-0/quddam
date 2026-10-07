import {NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden} from "@/lib/http";
import {orderingResponse,privateHeaders} from "@/lib/games/ordering/http";
import {getOrderingView} from "@/lib/games/ordering/service";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const user=await currentUser();if(!user)return forbidden();return NextResponse.json(await getOrderingView((await params).id,{kind:"HOST",id:user.id}),{headers:privateHeaders});}catch(e){return orderingResponse(e);}}
