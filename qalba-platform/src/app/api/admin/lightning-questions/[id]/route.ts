import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {lightningResponse,privateHeaders} from "@/lib/games/lightning/http";
import {db} from "@/lib/db";
import {questionSchema} from "@/lib/games/lightning/validation";
import {LightningError,normalize} from "@/lib/games/lightning/module";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();const input=await parseJson(request,questionSchema),{id}=await params;const row=await db().$transaction(async tx=>{await tx.$queryRawUnsafe('SELECT "id" FROM "Category" WHERE "id"=$1 FOR SHARE',input.categoryId);const category=await tx.category.findUnique({where:{id:input.categoryId}});if(!category||input.status==="PUBLISHED"&&!category.active)throw new LightningError("اختر فئة موجودة وفعالة للنشر",400);await tx.$queryRawUnsafe('SELECT "id" FROM "LightningQuestion" WHERE "id"=$1 FOR UPDATE',id);return tx.lightningQuestion.update({where:{id},data:{...input,normalizedQuestion:normalize(input.question)}});});return NextResponse.json(row,{headers:privateHeaders});}catch(error){return lightningResponse(error);}}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();return NextResponse.json(await db().lightningQuestion.update({where:{id:(await params).id},data:{status:"ARCHIVED"}}),{headers:privateHeaders});}catch(error){return lightningResponse(error);}}
