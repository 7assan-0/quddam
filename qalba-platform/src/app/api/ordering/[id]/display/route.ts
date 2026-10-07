import {NextRequest,NextResponse} from "next/server";
import {orderingResponse,privateHeaders} from "@/lib/games/ordering/http";
import {getOrderingView} from "@/lib/games/ordering/service";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{return NextResponse.json(await getOrderingView((await params).id,{kind:"DISPLAY",token:request.nextUrl.searchParams.get("token")??""}),{headers:privateHeaders});}catch(e){return orderingResponse(e);}}
