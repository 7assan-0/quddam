import { NextRequest,NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { errorResponse,forbidden,parseJson,requireSameOrigin } from "@/lib/http";
import { letterQuestionSchema } from "@/lib/games/letter-network/validation";
import { normalizeArabic } from "@/lib/games/letter-network/module";
export async function GET(request:NextRequest){
  try{if((await currentUser())?.role!=="ADMIN")return forbidden();
    const q=(request.nextUrl.searchParams.get("q")??"").trim().slice(0,100),letter=normalizeArabic(request.nextUrl.searchParams.get("letter")??"");
    return NextResponse.json(await db().letterQuestion.findMany({where:{...(letter?{letter}:{}),...(q?{OR:[{question:{contains:q,mode:"insensitive"}},{answer:{contains:q,mode:"insensitive"}}]}:{})},include:{category:{select:{title:true}}},orderBy:{createdAt:"desc"},take:200}),{headers:{"Cache-Control":"no-store"}});
  }catch(error){return errorResponse(error);}
}
export async function POST(request:NextRequest){
  if(!requireSameOrigin(request))return forbidden();
  try{if((await currentUser())?.role!=="ADMIN")return forbidden();const input=await parseJson(request,letterQuestionSchema);
    if(!await db().category.findUnique({where:{id:input.categoryId}}))return NextResponse.json({error:"الفئة غير موجودة"},{status:400});
    return NextResponse.json(await db().letterQuestion.create({data:input,include:{category:{select:{title:true}}}}),{status:201});
  }catch(error){return errorResponse(error);}
}

