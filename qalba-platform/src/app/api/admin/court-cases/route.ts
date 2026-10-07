import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {courtResponse,privateHeaders} from "@/lib/games/court/http";
import {db} from "@/lib/db";
import {caseSchema} from "@/lib/games/court/validation";
import {saveCourtCase} from "@/lib/games/court/admin";
export async function GET(request:NextRequest){try{if((await currentUser())?.role!=="ADMIN")return forbidden();const q=(request.nextUrl.searchParams.get("q")??"").trim().slice(0,100),categoryId=(request.nextUrl.searchParams.get("categoryId")??"").slice(0,100),status=request.nextUrl.searchParams.get("status"),difficulty=request.nextUrl.searchParams.get("difficulty");return NextResponse.json(await db().courtCase.findMany({where:{...(q?{title:{contains:q,mode:"insensitive"}}:{}),...(categoryId?{categoryId}:{}),...(["DRAFT","PUBLISHED","ARCHIVED"].includes(status??"")?{status:status as "DRAFT"|"PUBLISHED"|"ARCHIVED"}:{}),...(["EASY","MEDIUM","HARD"].includes(difficulty??"")?{difficulty:difficulty as "EASY"|"MEDIUM"|"HARD"}:{})},orderBy:{createdAt:"desc"},include:{facts:{orderBy:{position:"asc"}}},take:500}),{headers:privateHeaders});}catch(error){return courtResponse(error);}}
export async function POST(request:NextRequest){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();const input=await parseJson(request,caseSchema);const row=await saveCourtCase(input);return NextResponse.json(row,{status:201,headers:privateHeaders});}catch(error){return courtResponse(error);}}
