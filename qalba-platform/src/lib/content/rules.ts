import { z } from 'zod';
/** Editorial keys only. This never replaces any engine's answer matcher. */
export function contentKey(value: string) {
  return value.normalize('NFC').replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, '')
    .replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('ar');
}
export function authoredTextIssue(value: string): string | null {
  if (/\uFFFD|<\/?[a-z][^>]*>|```|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/iu.test(value)) return 'ENCODING_OR_MARKUP';
  if (/\b(?:TODO|FIXME|lorem ipsum|debug placeholder)\b|^(?:test|sample|placeholder|اختبار تجريبي)$/iu.test(value.trim())) return 'PLACEHOLDER';
  return null;
}
export function contentText(min: number, max: number) {
  return z.string().trim().min(min).max(max).refine(v => !authoredTextIssue(v), 'محتوى غير صالح للنشر: راجع النص والمحارف والعلامات التجريبية');
}
export function uniqueContent(values: string[]) { return new Set(values.map(contentKey)).size === values.length; }
