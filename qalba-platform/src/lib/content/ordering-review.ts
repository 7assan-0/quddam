import {contentKey} from './rules';
type Challenge={instruction:string;orderingType:string;items:{label:string;correctPosition:number;displayValue:string|null}[]};
const orbit=['عطارد','الزهرة','الأرض','المريخ','المشتري','زحل','أورانوس','نبتون'].map(contentKey);
const diameter=['عطارد','المريخ','الزهرة','الأرض','نبتون','أورانوس','زحل','المشتري'].map(contentKey);
const prefixes:Record<string,number>={'بيكو':-12,'نانو':-9,'ميكرو':-6,'ملي':-3,'سنتي':-2,'ديسي':-1,'ديكا':1,'هكتو':2,'كيلو':3,'ميغا':6,'غيغا':9,'تيرا':12,'بيتا':15,'إكسا':18};
function digits(s:string){return s.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));}
export function orderingCanonicalIssue(q:Challenge):string|null{
 const ordered=[...q.items].sort((a,b)=>a.correctPosition-b.correctPosition);let values:number[]|null=null;
 if(q.instruction.includes('مسافة المدار'))values=ordered.map(i=>orbit.indexOf(contentKey(i.label)));
 else if(q.instruction.includes('قطرًا استوائيًا'))values=ordered.map(i=>diameter.indexOf(contentKey(i.label)));
 else if(q.instruction.includes('بادئات النظام الدولي'))values=ordered.map(i=>prefixes[i.label]);
 else if(q.instruction.includes('حسب السنوات المذكورة'))values=ordered.map(i=>Number(digits(i.label).match(/سنة (\d+)$/)?.[1]));
 else if(q.instruction.includes('قيم التعبيرات')){
  values=ordered.map(i=>Number(i.displayValue));
  for(const i of ordered){const expression=digits(i.label);let calculated:number|undefined;const parts=expression.match(/^(\d+) × (\d+)(?: \+ (\d+))?$/);if(parts)calculated=Number(parts[1])*Number(parts[2])+Number(parts[3]??0);const plus=expression.match(/^(\d+) \+ (\d+)$/);if(plus)calculated=Number(plus[1])+Number(plus[2]);const square=expression.match(/^(\d+)²$/);if(square)calculated=Number(square[1])**2;if(calculated===undefined||calculated!==Number(i.displayValue))return 'ARITHMETIC_VALUE_MISMATCH';}
 }
 if(values){if(values.some(v=>!Number.isFinite(v)))return 'UNKNOWN_CANONICAL_VALUE';const descending=q.orderingType.endsWith('_DESC');if(values.some((v,i)=>i>0&&(descending?v>=values![i-1]:v<=values![i-1])))return 'WRONG_CANONICAL_ORDER';}
 return null;
}
