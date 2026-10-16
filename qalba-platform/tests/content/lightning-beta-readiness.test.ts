import { describe, expect, it } from 'vitest';
import { auditLightningBeta, lightningBetaDecision } from '../../src/lib/content/lightning-beta';
import { sourceBanks } from '../../src/lib/content/source';
import { lightningBoardSemanticExclusions } from '../../prisma/lightning-editorial-exclusions';

const original = sourceBanks();
const fixture = () => structuredClone({
 'category-board': original['category-board'],
 'lightning-quiz': original['lightning-quiz'],
});

describe('strict Lightning Beta content acceptance', () => {
 it('counts only structurally valid eligible items, not historical archived records', () => {
  const data = fixture(), before = JSON.stringify(data), result = auditLightningBeta(data);
  expect(result).toMatchObject({
   authored: 605, eligible: 600, structurallyValidEligible: 600,
   categoriesWithAtLeast40: 15, errors: [], verdict: 'PASS', nonMutating: true,
  });
  expect(Object.values(result.categories).sort()).toEqual(Array(15).fill(40));
  expect(JSON.stringify(data)).toBe(before);
  expect(lightningBetaDecision(result, null)).toBe('NOT_RUN_DATABASE');
  expect(lightningBetaDecision(result, result)).toBe('PASS');
 });

 it('blocks a published bank reduced to 599 even though generic engine needs only fifteen', () => {
  const data = fixture();
  const candidate = data['lightning-quiz'].find(row => row.status === 'PUBLISHED')!;
  candidate.status = 'ARCHIVED';
  const result = auditLightningBeta(data);
  expect(result.eligible).toBe(599);
  expect(result.errors).toContainEqual({ code: 'LIGHTNING_BETA_VALID_600_REQUIRED', ids: [] });
  expect(result.errors).toContainEqual({ code: 'LIGHTNING_BETA_15_CATEGORIES_40_EACH_REQUIRED', ids: [] });
  expect(result.verdict).toBe('FAIL');
  expect(lightningBetaDecision(auditLightningBeta(fixture()), result)).toBe('FAIL');
 });

 it('blocks invalid published content even when raw candidate count is six hundred', () => {
  const data = fixture();
  const row = data['lightning-quiz'].find(q => q.status === 'PUBLISHED')!;
  row.answer = 'TODO';
  const result = auditLightningBeta(data);
  expect(result.eligible).toBe(600);
  expect(result.structurallyValidEligible).toBe(599);
  expect(result.errors.some(e => e.code === 'INVALID_STRUCTURE')).toBe(true);
  expect(result.errors.some(e => e.code === 'LIGHTNING_BETA_VALID_600_REQUIRED')).toBe(true);
  expect(result.verdict).toBe('FAIL');
 });

 it('fails a database-style bank with the five legacy equivalent rows still published', () => {
  const data = fixture();
  for (const { lightningId } of lightningBoardSemanticExclusions) {
   data['lightning-quiz'].find(q => q.id === lightningId)!.status = 'PUBLISHED';
  }
  const before = JSON.stringify(data);
  const result = auditLightningBeta(data);
  expect(result.eligible).toBe(605);
  expect(result.errors.filter(e => e.code === 'LIGHTNING_BOARD_SEMANTIC_OVERLAP')).toHaveLength(5);
  expect(result.verdict).toBe('FAIL');
  expect(JSON.stringify(data)).toBe(before);
 });

 it('rejects a new normalized board duplicate without modifying either game bank', () => {
  const data = fixture(), board = data['category-board'][0];
  const lightning = data['lightning-quiz'].find(q => q.status === 'PUBLISHED')!;
  lightning.question = '  ' + String(board.question) + ' ؟ ';
  const before = JSON.stringify(data);
  const result = auditLightningBeta(data);
  expect(result.errors.some(e => e.code === 'LIGHTNING_BOARD_CONFLICTING_ANSWER' || e.code === 'LIGHTNING_BOARD_PROMPT_OVERLAP')).toBe(true);
  expect(result.verdict).toBe('FAIL');
  expect(JSON.stringify(data)).toBe(before);
 });

 it('does not certify a source-only audit as a database pass', () => {
  const result = auditLightningBeta(fixture());
  expect(lightningBetaDecision(result, null)).toBe('NOT_RUN_DATABASE');
 });
});
