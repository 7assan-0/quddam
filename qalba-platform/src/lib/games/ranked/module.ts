export const ROUND_COUNT=5, ATTEMPTS_PER_TEAM=10, TURN_MS=20_000;
export type Phase="LOBBY"|"READY"|"ROUND_INTRO"|"GUESS_ACTIVE"|"PAUSED"|"ROUND_RESULTS"|"FINAL_RESULTS"|"COMPLETED"|"ABANDONED";
export type Entry={rank:number;answer:string;alternativeAnswers:string[];points:number;displayValue:string|null};
export type List={title:string;description:string|null;kind:"CURATED"|"FACTUAL";sourceLabel:string|null;sourceUrl:string|null;sourceDate:string|null;notes:string|null;entries:Entry[]};
export type Discovery={rank:number;status:"REVEALED"|"REVEALED_VOID";teamIndex:number|null};
export type Result={kind:"CORRECT"|"WRONG"|"ALREADY_REVEALED"|"TIMEOUT"|"VOIDED";rank:number|null};
export type Frame={activeIndex:number;attempts:number[];scores:number[];roundPoints:number[];revealed:Discovery[];deadlineAt:number|null};
export type State=Frame & {module:"RANKED_LIST";schemaVersion:1;phase:Phase;pausedPhase:Phase|null;pausedAt:number|null;remainingMs:number|null;matchNumber:number;roundIndex:number;useIds:string[];teamIds:string[];history:{before:Frame;result:Result}[];lastResult:Result|null;lastEvent:string[];results:{round:number;points:number[];found:number[]}[]};
export type Action={type:"START"|"START_ROUND"|"PAUSE"|"RESUME"|"UNDO"|"END_ROUND"|"NEXT_ROUND"|"COMPLETE"|"REMATCH"|"ABANDON"}|{type:"SUBMIT_GUESS";guess:string};
export class RankedError extends Error{constructor(message:string,public status=409,public code="INVALID_ACTION"){super(message);}}
export function normalize(text:string){return text.normalize("NFC").replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu,"").replace(/[أإآٱ]/gu,"ا").replace(/ى/gu,"ي").trim().replace(/\s+/gu," ").toLocaleLowerCase("ar");}
export function bounded(text:string,max=160){if(/[\p{Cc}\p{Cf}]/u.test(text)||!normalize(text)||text.trim().length>max)throw new RankedError("اكتب نصًا صالحًا دون محارف خفية أو تحكم",400,"INVALID_TEXT");return text.trim().replace(/\s+/gu," ");}
export function validateList(list:List){bounded(list.title,250);if(list.description)bounded(list.description,1000);if(list.notes)bounded(list.notes,1000);if(!["CURATED","FACTUAL"].includes(list.kind))throw new RankedError("نوع القائمة غير صالح",400);
 if(list.entries.length<5||list.entries.length>200)throw new RankedError("يلزم من ٥ إلى ٢٠٠ عنصر",400,"INVALID_LIST");
 const seen=new Set<string>();for(const [i,e] of [...list.entries].sort((a,b)=>a.rank-b.rank).entries()){
  if(e.rank!==i+1||!Number.isInteger(e.rank))throw new RankedError("المراتب متصلة وفريدة وتبدأ من ١",400,"INVALID_RANKS");
  if(!Number.isInteger(e.points)||e.points<1||e.points>1000)throw new RankedError("النقاط عدد صحيح من ١ إلى ١٠٠٠",400,"INVALID_POINTS");
  if(e.alternativeAnswers.length>12)throw new RankedError("البدائل كثيرة",400);
  for(const a of [e.answer,...e.alternativeAnswers]){const key=normalize(bounded(a));if(seen.has(key))throw new RankedError("إجابة أو بديل يتعارض مع عنصر آخر",400,"ALIAS_COLLISION");seen.add(key);}
  if(e.displayValue)bounded(e.displayValue,100);
 }
 if(list.entries.reduce((n,e)=>n+e.points,0)>100000)throw new RankedError("مجموع النقاط كبير",400);
 if(list.kind==="FACTUAL"&&(!list.sourceLabel||!list.sourceUrl||!list.sourceDate))throw new RankedError("التصنيف الواقعي يحتاج مصدرًا ورابطًا وتاريخًا",400,"SOURCE_REQUIRED");
 if(list.sourceLabel)bounded(list.sourceLabel,200);if(list.sourceUrl){try{if(new URL(list.sourceUrl).protocol!=="https:")throw 0;}catch{throw new RankedError("رابط المصدر يجب أن يكون HTTPS",400);}}
 if(list.sourceDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(list.sourceDate)||!Number.isFinite(Date.parse(list.sourceDate))||new Date(list.sourceDate).toISOString().slice(0,10)!==list.sourceDate||Date.parse(list.sourceDate)>Date.now()))throw new RankedError("تاريخ المصدر غير صالح",400);
 return true;
}
export function lobby():State{return {module:"RANKED_LIST",schemaVersion:1,phase:"LOBBY",pausedPhase:null,pausedAt:null,remainingMs:null,matchNumber:0,roundIndex:0,useIds:[],teamIds:[],activeIndex:0,attempts:[0,0],scores:[0,0],roundPoints:[0,0],revealed:[],deadlineAt:null,history:[],lastResult:null,lastEvent:[],results:[]};}
export function assertPhase(s:State,...p:Phase[]){if(!p.includes(s.phase))throw new RankedError("الإجراء غير متاح في هذه المرحلة",409,"INVALID_PHASE");}
export function fresh(s:State,teams:string[],ids:string[]):State{if(teams.length!==2||new Set(teams).size!==2||ids.length!==ROUND_COUNT||new Set(ids).size!==ROUND_COUNT)throw new RankedError("تجهيز المباراة غير صالح",400);return {...lobby(),phase:"READY",matchNumber:s.matchNumber+1,teamIds:[...teams],useIds:[...ids],lastEvent:["RANKED_GAME_STARTED"]};}
export function expired(s:State,now:number){return s.phase==="GUESS_ACTIVE"&&s.deadlineAt!==null&&now>=s.deadlineAt;}
function frame(s:State):Frame{return structuredClone({activeIndex:s.activeIndex,attempts:s.attempts,scores:s.scores,roundPoints:s.roundPoints,revealed:s.revealed,deadlineAt:s.deadlineAt});}
export function closeRound(s:State):State{return {...s,phase:"ROUND_RESULTS",deadlineAt:null,remainingMs:null,history:[],lastEvent:[...s.lastEvent,"RANKED_ROUND_COMPLETED"],results:[...s.results,{round:s.roundIndex+1,points:[...s.roundPoints],found:[0,1].map(i=>s.revealed.filter(r=>r.status==="REVEALED"&&r.teamIndex===i).length)}]};}
export function resolve(s:State,list:List,guess:string|null,now:number):State{assertPhase(s,"GUESS_ACTIVE");if(guess===null&&!expired(s,now))throw new RankedError("لم تنته المهلة",409,"TIMER_NOT_EXPIRED");if(guess!==null&&expired(s,now))throw new RankedError("انتهى وقت المحاولة",409,"TIMER_EXPIRED");const key=guess===null?null:normalize(bounded(guess)),entry=key===null?null:list.entries.find(e=>[e.answer,...e.alternativeAnswers].some(a=>normalize(a)===key));
 if(entry&&s.revealed.some(r=>r.rank===entry.rank))return {...s,lastResult:{kind:"ALREADY_REVEALED",rank:entry.rank},lastEvent:["RANKED_ALREADY_REVEALED"]};
 const n=structuredClone(s),result:Result={kind:guess===null?"TIMEOUT":entry?"CORRECT":"WRONG",rank:entry?.rank??null};
 n.history=[...n.history,{before:frame(s),result}].slice(-20);n.lastResult=result;n.attempts[s.activeIndex]++;
 if(entry){n.revealed.push({rank:entry.rank,status:"REVEALED",teamIndex:s.activeIndex});n.scores[s.activeIndex]+=entry.points;n.roundPoints[s.activeIndex]+=entry.points;}
 n.activeIndex=1-s.activeIndex;n.deadlineAt=now+TURN_MS;n.lastEvent=[entry?"RANKED_GUESS_CORRECT":"RANKED_GUESS_WRONG",...(entry?["RANKED_ENTRY_REVEALED"]:[]),"RANKED_TURN_CHANGED"];
 return n.revealed.length===list.entries.length||n.attempts.every(v=>v>=ATTEMPTS_PER_TEAM)?closeRound(n):n;
}
export function transition(s:State,action:Action,list:List|null,now:number):State{const n=structuredClone(s);switch(action.type){
 case "START_ROUND":assertPhase(s,"READY","ROUND_INTRO");return {...n,phase:"GUESS_ACTIVE",activeIndex:s.roundIndex%2,attempts:[0,0],roundPoints:[0,0],revealed:[],history:[],lastResult:null,deadlineAt:now+TURN_MS,remainingMs:null,lastEvent:["RANKED_ROUND_STARTED"]};
 case "SUBMIT_GUESS":if(!list)throw new RankedError("القائمة مفقودة",500);return resolve(s,list,action.guess,now);
 case "END_ROUND":assertPhase(s,"GUESS_ACTIVE");return closeRound({...n,lastEvent:[]});
 case "UNDO":{assertPhase(s,"GUESS_ACTIVE");const previous=n.history.pop();if(!previous)throw new RankedError("لا توجد محاولة قابلة للتراجع",409,"UNDO_UNAVAILABLE");const voids=n.revealed.filter(r=>r.status==="REVEALED_VOID");Object.assign(n,previous.before);for(const r of voids)if(!n.revealed.some(v=>v.rank===r.rank))n.revealed.push(r);if(previous.result.kind==="CORRECT"){
 const rank=previous.result.rank!;if(!n.revealed.some(r=>r.rank===rank))n.revealed.push({rank,status:"REVEALED_VOID",teamIndex:null});n.lastResult={kind:"VOIDED",rank};}else n.lastResult=null;
 n.deadlineAt=Math.max(now,previous.before.deadlineAt??now);n.lastEvent=["RANKED_UNDO_AUDITED"];return list&&n.revealed.length===list.entries.length?closeRound(n):n;}
 case "PAUSE":assertPhase(s,"READY","ROUND_INTRO","GUESS_ACTIVE");return {...n,phase:"PAUSED",pausedPhase:s.phase,pausedAt:now,remainingMs:s.deadlineAt===null?null:Math.max(0,s.deadlineAt-now),deadlineAt:null,lastEvent:["RANKED_GAME_PAUSED"]};
 case "RESUME":{assertPhase(s,"PAUSED");if(!s.pausedPhase||s.pausedAt===null)throw new RankedError("توقف غير صالح",500);const shift=now-s.pausedAt;return {...n,phase:s.pausedPhase,pausedPhase:null,pausedAt:null,deadlineAt:s.remainingMs===null?null:now+s.remainingMs,history:n.history.map(h=>({...h,before:{...h.before,deadlineAt:h.before.deadlineAt===null?null:h.before.deadlineAt+shift}})),lastEvent:["RANKED_GAME_RESUMED"]};}
 case "NEXT_ROUND":assertPhase(s,"ROUND_RESULTS");return {...n,phase:s.roundIndex+1===ROUND_COUNT?"FINAL_RESULTS":"ROUND_INTRO",activeIndex:s.roundIndex+1===ROUND_COUNT?s.activeIndex:(s.roundIndex+1)%2,roundIndex:Math.min(ROUND_COUNT-1,s.roundIndex+1),revealed:s.roundIndex+1===ROUND_COUNT?n.revealed:[],history:[],lastResult:null,lastEvent:["RANKED_NEXT_ROUND"]};
 case "COMPLETE":assertPhase(s,"FINAL_RESULTS");return {...n,phase:"COMPLETED",lastEvent:["RANKED_GAME_COMPLETED"]};
 case "ABANDON":if(["COMPLETED","ABANDONED"].includes(s.phase))throw new RankedError("انتهت المباراة");return {...n,phase:"ABANDONED",deadlineAt:null,remainingMs:null,history:[],lastEvent:["RANKED_GAME_ABANDONED"]};
 default:throw new RankedError("الإجراء يحتاج تحضير الخادم");}}
export function slots(s:State,list:List|null){if(!list||["LOBBY","READY","ROUND_INTRO","ABANDONED"].includes(s.phase==="PAUSED"?s.pausedPhase!:s.phase))return [];const all=["ROUND_RESULTS","FINAL_RESULTS","COMPLETED"].includes(s.phase);return [...list.entries].sort((a,b)=>a.rank-b.rank).map(e=>{const found=s.revealed.find(r=>r.rank===e.rank);return {rank:e.rank,points:e.points,revealed:Boolean(found)||all,...(found||all?{answer:e.answer,displayValue:e.displayValue,status:found?.status??"UNFOUND",discoveredBy:found?.teamIndex===null||found?.teamIndex===undefined?null:s.teamIds[found.teamIndex]}:{})};});}
export function winners(s:State){return s.teamIds.filter((_,i)=>s.scores[i]===Math.max(...s.scores));}
export function recentPool<T extends {id:string}>(items:T[],recent:string[],random:(max:number)=>number){const shuffle=(v:T[])=>{const n=[...v];for(let i=n.length-1;i>0;i--){const j=random(i+1);[n[i],n[j]]=[n[j],n[i]];}return n;};const set=new Set(recent);return [...shuffle(items.filter(v=>!set.has(v.id))),...shuffle(items.filter(v=>set.has(v.id)))];}
