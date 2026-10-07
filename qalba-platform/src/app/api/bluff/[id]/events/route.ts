import {NextRequest,NextResponse} from "next/server";
import {currentAuthSession} from "@/lib/auth/session";
import {getBluffView,cookieName,type Actor} from "@/lib/games/bluff/service";
import {bluffResponse} from "@/lib/games/bluff/http";
import { createHostSessionGuard } from "@/lib/auth/host-stream";
import { realtimeResponse } from "@/lib/realtime/stream";
import { createViewPoll } from "@/lib/realtime/view-poll";
export const runtime="nodejs";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 let originalSessionId = "";
 const {id}=await params,audience=request.nextUrl.searchParams.get("audience");let hostSession: ReturnType<typeof createHostSessionGuard> | undefined;let actor:Actor;
 if(audience==="host"){const auth=await currentAuthSession();if(!auth)return NextResponse.json({error:"غير مصرح"},{status:403});actor={kind:"HOST",id:auth.user.id};hostSession=createHostSessionGuard(auth);originalSessionId=auth.sessionId;}
 else if(audience==="player")actor={kind:"PLAYER",token:request.cookies.get(cookieName(id))?.value??""};
 else if(audience==="display")actor={kind:"DISPLAY",token:request.nextUrl.searchParams.get("token")??""};
 else return NextResponse.json({error:"نوع العرض غير صالح"},{status:400});
 let initial;try{initial=await getBluffView(id,actor);}catch(error){return bluffResponse(error);}return realtimeResponse(request, {
    sessionId: id, audience: actor.kind,
    credential: actor.kind === "HOST" ? originalSessionId : actor.token,
    initial, cadence: 1000,
    next: createViewPoll({ id, initial, host: actor.kind === "HOST", read: () => getBluffView(id, actor) }),
    assertActive: hostSession ? async () => { await hostSession?.assertActive(); } : undefined,
  });
}
