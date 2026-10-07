import type {PrismaClient} from '../../generated/prisma/client';
import plan from '../../../prisma/content-remediation-plan.json';
import {duplicateOrderingIds} from '../../../prisma/content-remediations';
import {orderingSamples} from '../../../prisma/ordering-questions';
/** Explicit reviewed bank edits only. Never writes session/use snapshots or scores. */
export async function remediateContent(db:PrismaClient,apply=false){
 const result={dryRun:!apply,eligible:0,changed:0,alreadyApplied:0,skippedEdited:0};
 const knownTables=new Set(['Question','BluffQuestion','LetterQuestion','RankedListQuestion','LightningQuestion']);
 for(const patch of plan){
  if(!knownTables.has(patch.table))throw Error('Unsupported reviewed content model');
  await db.$transaction(async tx=>{
   const found=await tx.$queryRawUnsafe<Record<string,unknown>[]>(`SELECT * FROM "${patch.table}" WHERE id=$1 FOR UPDATE`,patch.id);const row=found[0];if(!row){result.skippedEdited++;return;}
   if(Object.entries(patch.after).every(([k,v])=>row[k]===v)){result.alreadyApplied++;return;}
   if(!Object.entries(patch.before).every(([k,v])=>row[k]===v)){result.skippedEdited++;return;}
   result.eligible++;if(!apply)return;const entries=Object.entries(patch.after);await tx.$executeRawUnsafe(`UPDATE "${patch.table}" SET ${entries.map(([k],i)=>`"${k}"=$${i+2}`).join(',')},"updatedAt"=now() WHERE id=$1`,patch.id,...entries.map(([,v])=>v));result.changed++;
  });
 }
 for(const id of duplicateOrderingIds){await db.$transaction(async tx=>{
  const rows=await tx.$queryRawUnsafe<{id:string;title:string;instruction:string;status:string}[]>('SELECT id,title,instruction,status FROM "OrderingQuestion" WHERE id=$1 FOR UPDATE',id);const row=rows[0];if(!row){result.skippedEdited++;return;}if(row.status==='ARCHIVED'){result.alreadyApplied++;return;}
  const sample=orderingSamples.find(q=>q.id===id)!;const items=await tx.orderingItem.findMany({where:{questionId:id},orderBy:{correctPosition:'asc'}});
  if(row.status!=='PUBLISHED'||row.title!==sample.title||row.instruction!==sample.instruction||JSON.stringify(items.map(i=>[i.label,i.correctPosition,i.acceptedAliases]))!==JSON.stringify(sample.items.map(i=>[i.label,i.correctPosition,i.acceptedAliases]))){result.skippedEdited++;return;}
  result.eligible++;if(apply){await tx.orderingQuestion.update({where:{id},data:{status:'ARCHIVED'}});result.changed++;}
 });}
 // Metadata labels only; match the precise former seed label, preserving editorial edits.
 for(const [table,prefix,field,before,after] of [['Question','seed-category-','source','محتوى تجريبي أصلي','إعداد تحريري لقدّام'],['RankedListQuestion','ranked-seed-','sourceLabel','إعداد تحريري أصلي لقلبة','إعداد تحريري لقدّام']] as const){
  await db.$transaction(async tx=>{const rows=await tx.$queryRawUnsafe<{id:string}[]>(`SELECT id FROM "${table}" WHERE id LIKE $1 AND "${field}"=$2 ORDER BY id FOR UPDATE`,prefix+'%',before);result.eligible+=rows.length;if(apply&&rows.length){result.changed+=await tx.$executeRawUnsafe(`UPDATE "${table}" SET "${field}"=$1,"updatedAt"=now() WHERE id=ANY($2::text[]) AND "${field}"=$3`,after,rows.map(r=>r.id),before);}});
 }
 return result;
}
