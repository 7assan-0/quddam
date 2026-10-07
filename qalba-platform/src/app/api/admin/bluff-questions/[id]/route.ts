import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {bluffResponse,privateHeaders} from "@/lib/games/bluff/http";
import {db} from "@/lib/db";
import {questionSchema} from "@/lib/games/bluff/validation";
import {BluffError} from "@/lib/games/bluff/module";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();const input=await parseJson(request,questionSchema),{id}=await params;const row=await db().$transaction(async tx=>{await tx.$queryRawUnsafe('SELECT "id" FROM "Category" WHERE "id"=$1 FOR SHARE',input.categoryId);const category=await tx.category.findUnique({where:{id:input.categoryId}});if(!category||input.status==="PUBLISHED"&&!category.active)throw new BluffError("اختر فئة موجودة وفعالة للنشر",400);return tx.bluffQuestion.update({where:{id},data:input});});return NextResponse.json(row,{headers:privateHeaders});}catch(error){return bluffResponse(error);}}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();return NextResponse.json(await db().bluffQuestion.update({where:{id:(await params).id},data:{status:"ARCHIVED"}}),{headers:privateHeaders});}catch(error){return bluffResponse(error);}}
