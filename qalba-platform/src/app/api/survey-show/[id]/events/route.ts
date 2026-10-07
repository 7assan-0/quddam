import { NextRequest,NextResponse } from "next/server";
import { currentAuthSession } from "@/lib/auth/session";
import { getSurveyView,type Audience } from "@/lib/games/survey-battle/service";
import { SurveyError } from "@/lib/games/survey-battle/module";
import { errorResponse } from "@/lib/http";
import { createHostSessionGuard } from "@/lib/auth/host-stream";
import { realtimeResponse } from "@/lib/realtime/stream";
import { createViewPoll } from "@/lib/realtime/view-poll";
export const runtime="nodejs";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  let originalSessionId = "";
 const id=(await params).id,audience=request.nextUrl.searchParams.get("audience");let hostSession: ReturnType<typeof createHostSessionGuard> | undefined;let actor:Audience;
  if(audience==="host"){const auth=await currentAuthSession();if(!auth)return NextResponse.json({error:"غير مصرح"},{status:403});actor={kind:"HOST",id:auth.user.id};hostSession=createHostSessionGuard(auth);originalSessionId=auth.sessionId;}
  else if(audience==="display")actor={kind:"DISPLAY",token:request.nextUrl.searchParams.get("token")??""};
  else return NextResponse.json({error:"نوع العرض غير صالح"},{status:400});
  let initial;
  try{initial=await getSurveyView(id,actor);}catch(error){if(error instanceof SurveyError)return NextResponse.json({error:error.message},{status:error.status});return errorResponse(error);}
  return realtimeResponse(request, {
    sessionId: id, audience: actor.kind,
    credential: actor.kind === "HOST" ? originalSessionId : actor.token,
    initial, cadence: 1000,
    next: createViewPoll({ id, initial, host: actor.kind === "HOST", resolvesDeadline: () => false, read: () => getSurveyView(id, actor) }),
    assertActive: hostSession ? async () => { await hostSession?.assertActive(); } : undefined,
  });
}
