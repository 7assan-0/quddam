import {NextResponse} from "next/server";
import {previewCourt} from "@/lib/games/court/service";
import {courtResponse,privateHeaders} from "@/lib/games/court/http";
export async function GET(_:Request,{params}:{params:Promise<{code:string}>}){try{return NextResponse.json(await previewCourt((await params).code),{headers:privateHeaders});}catch(e){return courtResponse(e);}}
