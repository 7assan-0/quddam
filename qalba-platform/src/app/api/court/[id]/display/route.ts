import {NextRequest,NextResponse} from "next/server";
import {courtResponse,privateHeaders} from "@/lib/games/court/http";
import {getCourtView} from "@/lib/games/court/service";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{return NextResponse.json(await getCourtView((await params).id,{kind:"DISPLAY",token:request.nextUrl.searchParams.get("token")??""}),{headers:privateHeaders});}catch(e){return courtResponse(e);}}
