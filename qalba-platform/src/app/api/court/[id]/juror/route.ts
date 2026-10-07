import {NextRequest,NextResponse} from "next/server";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {getCourtView,cookieName,submitCourtVote} from "@/lib/games/court/service";
import {courtResponse,privateHeaders} from "@/lib/games/court/http";
import {voteSchema} from "@/lib/games/court/validation";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;return NextResponse.json(await getCourtView(id,{kind:"JUROR",token:request.cookies.get(cookieName(id))?.value??""}),{headers:privateHeaders});}catch(e){return courtResponse(e);}}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{const {id}=await params,v=await parseJson(request,voteSchema);return NextResponse.json(await submitCourtVote(id,request.cookies.get(cookieName(id))?.value??"",v.key,v.matchNumber,v.roundNumber,v.choice),{headers:privateHeaders});}catch(e){return courtResponse(e);}}
