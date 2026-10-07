import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {orderingResponse,privateHeaders} from "@/lib/games/ordering/http";
import {db} from "@/lib/db";
import {questionSchema} from "@/lib/games/ordering/validation";
import {saveOrderingQuestion} from "@/lib/games/ordering/admin";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();const input=await parseJson(request,questionSchema),{id}=await params;const row=await saveOrderingQuestion(input,id);return NextResponse.json(row,{headers:privateHeaders});}catch(error){return orderingResponse(error);}}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();return NextResponse.json(await db().orderingQuestion.update({where:{id:(await params).id},data:{status:"ARCHIVED"}}),{headers:privateHeaders});}catch(error){return orderingResponse(error);}}
