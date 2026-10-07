import {NextResponse} from "next/server";
import {previewBluff} from "@/lib/games/bluff/service";
import {bluffResponse,privateHeaders} from "@/lib/games/bluff/http";
export async function GET(_request:Request,{params}:{params:Promise<{code:string}>}){try{return NextResponse.json(await previewBluff((await params).code),{headers:privateHeaders});}catch(error){return bluffResponse(error);}}
