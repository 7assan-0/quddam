import { LetterError } from "./module";
/** Never repeat within a match; prefer questions outside the account's recent history. */
export function questionPool<T extends {id:string}>(questions:T[],usedIds:string[],recentIds:string[]):T[]{
  const used=new Set(usedIds),recent=new Set(recentIds),unused=questions.filter(q=>!used.has(q.id));
  if(!unused.length)throw new LetterError("نفدت الأسئلة غير المستخدمة لهذا الحرف. اختر حرفًا آخر أو أضف أسئلة منشورة.",409,"LETTER_EXHAUSTED");
  const fresh=unused.filter(q=>!recent.has(q.id));return fresh.length?fresh:unused;
}

