import { NextRequest,NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { errorResponse,forbidden,parseJson,requireSameOrigin } from "@/lib/http";
import { letterQuestionSchema } from "@/lib/games/letter-network/validation";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!requireSameOrigin(request))return forbidden();
  try{if((await currentUser())?.role!=="ADMIN")return forbidden();const input=await parseJson(request,letterQuestionSchema);
    if(!await db().category.findUnique({where:{id:input.categoryId}}))return NextResponse.json({error:"الفئة غير موجودة"},{status:400});
    return NextResponse.json(await db().letterQuestion.update({where:{id:(await params).id},data:input,include:{category:{select:{title:true}}}}));
  }catch(error){return errorResponse(error);}
}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!requireSameOrigin(request))return forbidden();
  try{if((await currentUser())?.role!=="ADMIN")return forbidden();return NextResponse.json(await db().letterQuestion.update({where:{id:(await params).id},data:{status:"ARCHIVED"}}));}
  catch(error){return errorResponse(error);}
}

