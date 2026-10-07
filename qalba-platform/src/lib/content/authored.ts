import { authoredTextIssue } from './rules';
/** Content-authoring objects only; never a runtime session/projection. */
export function hasInvalidAuthoredText(value: unknown): boolean {
  if (typeof value === 'string') return Boolean(authoredTextIssue(value));
  if (Array.isArray(value)) return value.some(hasInvalidAuthoredText);
  if (value && typeof value === 'object') return Object.entries(value).some(([key, v]) => !['id', 'categoryId', 'sourceUrl'].includes(key) && hasInvalidAuthoredText(v));
  return false;
}
