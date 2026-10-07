import {NextRequest,NextResponse} from "next/server";
import {lightningResponse,privateHeaders} from "@/lib/games/lightning/http";
import {getLightningView} from "@/lib/games/lightning/service";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{return NextResponse.json(await getLightningView((await params).id,{kind:"DISPLAY",token:request.nextUrl.searchParams.get("token")??""}),{headers:privateHeaders});}catch(e){return lightningResponse(e);}}
