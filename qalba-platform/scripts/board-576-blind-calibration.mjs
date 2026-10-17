/** Blind candidate difficulty calibration. Never synthesizes human answers or auto-approves content.
 * Privacy: use pseudonymous participant slots P01..P12, no participant names, email, recordings or raw guessed words.
 * Usage:
 *   node scripts/board-576-blind-calibration.mjs --self-test
 *   node scripts/board-576-blind-calibration.mjs --plan /private/output
 *   node scripts/board-576-blind-calibration.mjs --analyze /private/output/responses.csv
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ledger = new URL("../content-review/2026-10-17/Board_576_Item_Review.csv", import.meta.url);
function csvParse(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for(let i = 0; i < text.length; i++) {
    const c = text[i];
    if(c === '"') { if(quoted && text[i+1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if(c === "," && !quoted) { row.push(cell); cell = ""; }
    else if((c === "\n" || c === "\r") && !quoted) { if(c === "\r" && text[i+1] === "\n") i++; row.push(cell); if(row.some(v=>v !== "")) rows.push(row); row=[];cell=""; }
    else cell += c;
  }
  assert.equal(quoted, false, "Broken CSV quoting");
  if(cell || row.length) { row.push(cell); rows.push(row); }
  const head=rows.shift();
  assert.ok(head?.length);
  return rows.map((values,i)=>{ assert.equal(values.length,head.length,"CSV column mismatch on line "+(i+2)); return Object.fromEntries(head.map((field,k)=>[field,values[k]])); });
}
function csvWrite(header, rows) { const line=v=>v.map(x=>'"'+String(x??"").replaceAll('"','""')+'"').join(","); return [line(header),...rows.map(row=>line(header.map(k=>row[k])))].join("\n")+"\n"; }
const source=csvParse(readFileSync(ledger,"utf8"));
assert.equal(source.length,576,"Editorial source must contain exactly 576 questions");
const ids=new Set(source.map(x=>x.stable_id));
assert.equal(ids.size,576,"Question IDs must be unique");
for(let i=0;i<576;i++)assert.equal(source[i].stable_id,`seed-category-${i+1}`,"Starter/source identity and order changed");
for(const tier of ["200","400","600"])assert.equal(source.filter(x=>x.point_value===tier).length,192);
const category=[...new Set(source.map(x=>x.category_slug))];
assert.equal(category.length,6);
for(const c of category)for(const tier of ["200","400","600"])assert.equal(source.filter(x=>x.category_slug===c&&x.point_value===tier).length,32);
const groups=[["A",1],["B",7]];
const sessions=6;
const assignments=[];
for(const tier of ["200","400","600"]){
  const items=source.filter(x=>x.point_value===tier);
  for(const [group,start] of groups)for(let index=0;index<items.length;index++)
    for(let shift=0;shift<3;shift++){
      const participant="P"+String(start+((index+shift)%6)).padStart(2,"0");
      assignments.push({group,participant_id:participant,question_id:items[index].stable_id,tier,session:""});
    }
}
const counts=new Map();
for(const row of assignments) {
  const key=row.participant_id+"|"+row.tier;
  const n=counts.get(key)||0; row.session=String(Math.floor(n/16)+1); counts.set(key,n+1);
}
assert.equal(assignments.length,3456);
for(let p=1;p<=12;p++)for(const t of ["200","400","600"])assert.equal(counts.get("P"+String(p).padStart(2,"0")+"|"+t),96);
for(let p=1;p<=12;p++)for(let session=1;session<=sessions;session++)
  for(const tier of ["200","400","600"])assert.equal(assignments.filter(a=>a.participant_id==="P"+String(p).padStart(2,"0")&&a.session===String(session)&&a.tier===tier).length,16);
const byQuestion=new Map();
for(const row of assignments){const key=row.question_id;const list=byQuestion.get(key)||[];list.push(row);byQuestion.set(key,list)}
for(const id of ids){const rows=byQuestion.get(id)||[];assert.equal(rows.length,6);assert.equal(rows.filter(x=>x.group==="A").length,3);assert.equal(rows.filter(x=>x.group==="B").length,3);assert.equal(new Set(rows.map(x=>x.participant_id)).size,6)}
const cols=["session","group","participant_id","question_id","tier","correct","seconds_elapsed","judge_flag"];
const key=x=>x.session+"|"+x.group+"|"+x.participant_id+"|"+x.question_id+"|"+x.tier;
const plan=new Map(assignments.map(row=>[key(row),row]));
assert.equal(plan.size,3456);
const cmd=process.argv[2];
if(cmd==="--self-test"){ console.log(JSON.stringify({status:"PASS",humanResponses:0,questions:576,groups:2,anonymousParticipants:12,attemptSlots:3456,attemptsPerQuestion:6,perParticipant:288,sessionsPerParticipant:6,questionsPerSession:48,approval:"NOT_RUN"})); }
else if(cmd==="--plan") {
  const dir=resolve(process.argv[3]??""); assert.ok(process.argv[3],"Provide a private output directory");
  mkdirSync(dir,{recursive:true,mode:0o700});
  // Pseudorandomise each participant/session pack independently; do not present easy/medium/hard in blocks.
  const shuffleKey=row=>createHash("sha256").update("QUDDAM-BLIND-PILOT-V1|"+row.participant_id+"|"+row.session+"|"+row.question_id).digest("hex");
  const ordered=[...assignments].sort((a,b)=>Number(a.session)-Number(b.session)||a.group.localeCompare(b.group)||a.participant_id.localeCompare(b.participant_id)||shuffleKey(a).localeCompare(shuffleKey(b)));
  writeFileSync(join(dir,"blind-assignments.csv"),csvWrite(cols.slice(0,5),ordered),{mode:0o600});
  writeFileSync(join(dir,"responses-EMPTY.csv"),csvWrite(cols,ordered.map(r=>({...r,correct:"",seconds_elapsed:"",judge_flag:""}))),{mode:0o600});
  console.log(JSON.stringify({status:"NOT_RUN",questionCount:576,anonymousAssignmentCount:3456,output:dir,note:"Blank responses: do not claim this is a completed human pilot"}));
}
else if(cmd==="--analyze") {
  assert.ok(process.argv[3],"Need an actual participant-filled CSV file");
  const responses=csvParse(readFileSync(resolve(process.argv[3]),"utf8"));
  assert.equal(responses.length,3456,"Partial or duplicate response roster: cannot certify pilot completeness");
  const seen=new Set(),result=[];
  for(const row of responses) {
    const k=key(row);assert.ok(plan.has(k),"Unassigned/mismatched response: "+k);assert.ok(!seen.has(k),"Duplicate response: "+k);seen.add(k);
    if(row.correct===""&&row.seconds_elapsed===""&&row.judge_flag==="")continue;
    assert.ok(["0","1"].includes(row.correct),"Correct must be 0/1, or entirely blank");
    const seconds=Number(row.seconds_elapsed);
    assert.ok(row.seconds_elapsed!==""&&Number.isFinite(seconds)&&seconds>0&&seconds<=180,"Answer time must be 1..180 sec");
    assert.ok(["","CLEAR","AMBIGUOUS","DISPUTED"].includes(row.judge_flag),"Unknown judge flag");
    result.push({...row,seconds,correct:Number(row.correct)});
  }
  const median=a=>{const s=[...a].sort((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2:null;};
  const gradeStats=(items)=>Object.fromEntries(["200","400","600"].map(t=>{const a=items.filter(x=>x.tier===t);return[t,{n:a.length,correctRate:a.length?a.reduce((s,x)=>s+x.correct,0)/a.length:null,medianSeconds:median(a.map(x=>x.seconds))}]}));
  const flags=[];
  for(const item of source){let rs=result.filter(x=>x.question_id===item.stable_id);if(rs.length<6)continue;const good=rs.reduce((s,x)=>s+x.correct,0),a=rs.filter(x=>x.group==="A").reduce((s,x)=>s+x.correct,0),b=rs.filter(x=>x.group==="B").reduce((s,x)=>s+x.correct,0);
    if((item.point_value==="200"&&good<=3)||(item.point_value==="600"&&good>=4)||Math.abs(a-b)>=2||rs.some(x=>["AMBIGUOUS","DISPUTED"].includes(x.judge_flag)))flags.push({id:item.stable_id,tier:item.point_value,correct:good,groupA:a,groupB:b,reason:rs.some(x=>["AMBIGUOUS","DISPUTED"].includes(x.judge_flag))?"JUDGED_AMBIGUOUS_OR_DISPUTED":"DIFFICULTY_OR_GROUP_DISAGREEMENT"});
  }
  const overall=gradeStats(result);
  const perCategory=Object.fromEntries(category.map(c=>[c,gradeStats(result.filter(x=>source.find(q=>q.stable_id===x.question_id)?.category_slug===c))]));
  const tier=Object.fromEntries(Object.entries(overall).map(([t,x])=>[t,{...x,target:t==="200"?">=70%":t==="400"?"35–70%":"<=40%"}]));
  const complete=result.length===3456;
  const categoryViolations=Object.entries(perCategory).flatMap(([cat,tiers])=>Object.entries(tiers).filter(([t,x])=>!complete||x.correctRate===null||(t==="200"?x.correctRate<.7:t==="400"?x.correctRate<.35||x.correctRate>.7:x.correctRate>.4)).map(([t,x])=>({category:cat,tier:t,correctRate:x.correctRate})));
  console.log(JSON.stringify({status:result.length===0?"NOT_RUN":!complete?"INCOMPLETE_NO_APPROVAL":"PILOT_DATA_COMPLETE_REQUIRES_HUMAN_EDITORIAL_DECISION",expected:3456,answered:result.length,overall:tier,perCategory,categoryViolations,flaggedQuestionCount:flags.length,flaggedQuestions:flags,approval:"NEVER_AUTOMATIC"},null,2));
}
else throw Error("Expected --self-test, --plan <private_dir> or --analyze <completed_responses_csv>");
