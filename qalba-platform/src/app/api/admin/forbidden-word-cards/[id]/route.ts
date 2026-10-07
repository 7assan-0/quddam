import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {db} from "@/lib/db";
import {errorResponse,forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {cardSchema} from "@/lib/games/forbidden-word/validation";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();const input=await parseJson(request,cardSchema),category=await db().category.findUnique({where:{id:input.categoryId}});if(!category||input.status==="PUBLISHED"&&!category.active)return NextResponse.json({error:"اختر فئة موجودة وفعّالة للنشر"},{status:400});return NextResponse.json(await db().forbiddenWordCard.update({where:{id:(await params).id},data:input}));}catch(error){return errorResponse(error);}}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();return NextResponse.json(await db().forbiddenWordCard.update({where:{id:(await params).id},data:{status:"ARCHIVED"}}));}catch(error){return errorResponse(error);}}
