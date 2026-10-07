import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "@/lib/auth/session";
import {forbidden,parseJson,requireSameOrigin} from "@/lib/http";
import {bluffResponse,privateHeaders} from "@/lib/games/bluff/http";
import {db} from "@/lib/db";
import {moderationSchema} from "@/lib/games/bluff/validation";
export async function GET(){try{if((await currentUser())?.role!=="ADMIN")return forbidden();const policy=await db().featureFlag.findUnique({where:{key:"bluff-moderation"}});return NextResponse.json(policy?.config??{blockedTerms:[]},{headers:privateHeaders});}catch(error){return bluffResponse(error);}}
export async function PUT(request:NextRequest){if(!requireSameOrigin(request))return forbidden();try{if((await currentUser())?.role!=="ADMIN")return forbidden();const config=await parseJson(request,moderationSchema);await db().featureFlag.upsert({where:{key:"bluff-moderation"},create:{key:"bluff-moderation",enabled:true,config},update:{enabled:true,config}});return NextResponse.json(config,{headers:privateHeaders});}catch(error){return bluffResponse(error);}}
