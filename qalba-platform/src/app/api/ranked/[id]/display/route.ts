import {NextRequest,NextResponse} from "next/server";
import {rankedResponse,privateHeaders} from "@/lib/games/ranked/http";
import {getRankedView} from "@/lib/games/ranked/service";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{return NextResponse.json(await getRankedView((await params).id,{kind:"DISPLAY",token:request.nextUrl.searchParams.get("token")??""}),{headers:privateHeaders});}catch(e){return rankedResponse(e);}}
