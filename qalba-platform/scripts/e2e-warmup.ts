import type { FullConfig } from "@playwright/test";
/** Read-only compile warm-up. Authentication/invalid-token denials are expected. */
export default async function warmup(config:FullConfig){
  if(!process.env.E2E_DATABASE_URL)return;
  const origin=config.projects[0].use.baseURL??"http://127.0.0.1:3000";
  const groups:Record<string,string[]>={
    platform:["/admin","/admin/questions","/admin/pricing"],
    board:["/games/category-board/new","/play/warmup","/display/warmup?token=invalid","/api/games/category-board/warmup/commands",
      "/api/games/category-board/warmup","/api/display/warmup","/api/display/warmup/events?token=invalid","/join?code=WARMUP","/rooms/WARMUP","/api/rooms/WARMUP/preview"],
    social:["/games/out-of-the-loop/new","/social/join?code=WARMUP","/social/host/warmup","/social/play/warmup","/social/display/warmup?token=invalid",
      "/api/social/warmup/commands","/api/social/warmup/join","/api/social/warmup/events?audience=display&token=invalid","/api/social/warmup",
      "/api/social/warmup/player","/api/social/warmup/display?token=invalid","/api/social/preview/WARMUP","/admin/secret-words"],
    letter:["/games/letter-network/new","/letter-network/host/warmup","/letter-network/display/warmup?token=invalid","/api/letter-network/warmup/commands",
      "/api/letter-network/warmup/display-access","/api/letter-network/warmup/events?audience=display&token=invalid","/api/letter-network/warmup",
      "/api/letter-network/warmup/display?token=invalid","/admin/letter-questions","/api/admin/letter-questions","/api/admin/letter-questions/warmup"],
    survey:["/games/survey-show/new","/survey-show/host/warmup","/survey-show/display/warmup?token=invalid","/api/survey-show/warmup/commands",
      "/api/survey-show/warmup/display-access","/api/survey-show/warmup/events?audience=display&token=invalid","/api/survey-show/warmup","/api/survey-show/warmup/display?token=invalid"],
    party:["/games/letter-battle/new","/games/bluff/new","/play/warmup","/play/warmup/display"],
  };
  // These cases need extra handlers; normal gameplay must not retain their
  // compiler graphs. Each survey case receives its own server in the DB runner.
  groups["survey-admin"]=[...groups.survey,"/admin/survey-questions","/api/admin/survey-questions","/api/admin/survey-questions/warmup"];
  groups["survey-policy"]=[...groups.survey,"/api/games/party/sessions/warmup","/api/games/party/sessions/warmup/commands"];
  groups["survey-history"]=[...groups.survey,"/profile"];
  groups.forbidden=["/games/secret-word/new","/secret-word/host/warmup","/secret-word/display/warmup?token=invalid","/api/secret-word/warmup/commands",
    "/api/secret-word/warmup/display-access","/api/secret-word/warmup/events?audience=display&token=invalid","/api/secret-word/warmup","/api/secret-word/warmup/display?token=invalid"];
  groups["forbidden-admin"]=[...groups.forbidden,"/admin/forbidden-word-cards","/api/admin/forbidden-word-cards","/api/admin/forbidden-word-cards/warmup"];
  groups["forbidden-history"]=[...groups.forbidden,"/profile"];
  groups["forbidden-phone"]=[...groups.forbidden,"/secret-word/clue/warmup?token=invalid","/api/secret-word/warmup/clue?token=invalid","/api/secret-word/warmup/clue-access"];
  groups["forbidden-policy"]=[...groups["forbidden-phone"],"/api/games/party/sessions/warmup","/api/games/party/sessions/warmup/commands"];

  groups.bluff=["/bluff/new","/bluff/join?code=WARMUP","/bluff/host/warmup","/bluff/play/warmup","/bluff/display/warmup?token=invalid","/api/bluff","/api/bluff/warmup","/api/bluff/warmup/player","/api/bluff/warmup/join","/api/bluff/warmup/commands","/api/bluff/warmup/display-access","/api/bluff/warmup/display?token=invalid","/api/bluff/warmup/events?audience=display&token=invalid","/api/bluff/preview/WARMUP"];
  groups["bluff-admin"]=[...groups.bluff,"/admin/bluff-questions","/api/admin/bluff-questions","/api/admin/bluff-questions/warmup","/api/admin/bluff-moderation","/api/admin/categories"];
  groups["bluff-history"]=[...groups.bluff,"/profile"];
  groups.ranked=["/ranked/new","/ranked/host/warmup","/ranked/display/warmup?token=invalid","/api/ranked","/api/ranked/warmup","/api/ranked/warmup/commands","/api/ranked/warmup/display-access","/api/ranked/warmup/display?token=invalid","/api/ranked/warmup/events?audience=display&token=invalid"];
  groups["ranked-admin"]=[...groups.ranked,"/admin/ranked-lists","/api/admin/ranked-lists","/api/admin/ranked-lists/warmup"];
  groups["ranked-history"]=[...groups.ranked,"/profile"];
  groups.lightning=["/lightning/new","/lightning/host/warmup","/lightning/display/warmup?token=invalid","/lightning/buzzer/warmup?token=invalid","/api/lightning","/api/lightning/warmup","/api/lightning/warmup/commands","/api/lightning/warmup/display-access","/api/lightning/warmup/display?token=invalid","/api/lightning/warmup/buzzer?token=invalid","/api/lightning/warmup/buzzer-access","/api/lightning/warmup/events?audience=display&token=invalid"];
  groups.ordering=["/ordering/new","/ordering/host/warmup","/ordering/display/warmup?token=invalid","/ordering/controller/warmup?token=invalid","/api/ordering","/api/ordering/warmup","/api/ordering/warmup/commands","/api/ordering/warmup/display-access","/api/ordering/warmup/display?token=invalid","/api/ordering/warmup/controller?token=invalid","/api/ordering/warmup/controller-access","/api/ordering/warmup/events?audience=display&token=invalid"];
  groups["ordering-admin"]=[...groups.ordering,"/admin/ordering-questions","/api/admin/ordering-questions","/api/admin/ordering-questions/warmup"];
  groups["ordering-history"]=[...groups.ordering,"/profile"];
  groups["lightning-admin"]=[...groups.lightning,"/admin/lightning-questions","/api/admin/lightning-questions","/api/admin/lightning-questions/warmup"];
  groups["lightning-history"]=[...groups.lightning,"/profile"];
  groups.court=["/court/new","/court/host/warmup","/court/join?code=WARMUP","/court/play/warmup","/court/display/warmup?token=invalid","/api/court","/api/court/warmup","/api/court/warmup/commands","/api/court/warmup/juror","/api/court/warmup/join","/api/court/warmup/display-access","/api/court/warmup/display?token=invalid","/api/court/warmup/events?audience=display&token=invalid","/api/court/preview/WARMUP"];
  groups["court-admin"]=[...groups.court,"/admin/court-cases","/api/admin/court-cases","/api/admin/court-cases/warmup"];
  groups["court-history"]=[...groups.court,"/profile"];
  const selected=process.env.E2E_WARMUP_GROUP;
  const routes=["/register","/login","/games",...(selected?groups[selected]??[]:Object.values(groups).flat())];
  for(const route of routes){
    const response=await fetch(new URL(route,origin),{signal:AbortSignal.timeout(30_000)});
    await response.arrayBuffer();
    if(response.status>=500)throw new Error("E2E warm-up server error: "+route+" ("+response.status+")");
  }
}
