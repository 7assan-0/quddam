import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {courtResponse,privateHeaders} from "@/lib/games/court/http";
import {db} from "@/lib/db";
import {caseSchema} from "@/lib/games/court/validation";
import {saveCourtCase} from "@/lib/games/court/admin";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();const input=await parseJson(request,caseSchema),{id}=await params;const row=await saveCourtCase(input,id);return NextResponse.json(row,{headers:privateHeaders});}catch(error){return courtResponse(error);}}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();return NextResponse.json(await db().courtCase.update({where:{id:(await params).id},data:{status:"ARCHIVED"}}),{headers:privateHeaders});}catch(error){return courtResponse(error);}}
