import { describe, expect, it } from 'vitest';
import { auditContent, lightningBoardOverlaps, contentValidationExitCode } from '../../src/lib/content/audit';
import { sourceBanks } from '../../src/lib/content/source';

describe('Lightning content beta gate versus Category Board', () => {
 const source = sourceBanks();
 const clone = () => structuredClone(source);

 it('keeps the expanded 360-prompt source separate from board without falsely passing the 600 editorial goal', () => {
  const report = auditContent(source);
  const lightning = report.games.find(g => g.game === 'lightning-quiz')!;
  expect(source['lightning-quiz']).toHaveLength(360);
  expect(lightningBoardOverlaps(source)).toEqual([]);
  expect(report.blockingErrors).toBe(0);
  expect(lightning.eligible).toBe(360);
  expect(lightning.warnings).toContainEqual({ code: 'LIGHTNING_EDITORIAL_TARGET_600_NOT_MET', ids: [] });
  expect(lightning.capacity).toBe('WARN');
 });

 it('blocks identical and Arabic-normalized/punctuation-only duplicated board prompts, disclosing IDs only', () => {
  const banks = clone();
  const board = banks['category-board'][0], lightning = banks['lightning-quiz'][0];
  lightning.question = '  ' + String(board.question).replace('كم', 'كَمْ') + ' ؟ ';
  lightning.answer = board.answer;
  const overlaps = lightningBoardOverlaps(banks);
  expect(overlaps).toEqual([{ code: 'LIGHTNING_BOARD_PROMPT_OVERLAP', ids: [board.id, lightning.id] }]);
  const report = auditContent(banks);
  expect(report.blockingErrors).toBe(1);
  expect(report.games.find(g => g.game === 'lightning-quiz')?.capacity).toBe('FAIL');
  expect(contentValidationExitCode(report, null)).toBe(1);
  expect(JSON.stringify(overlaps)).not.toContain(String(board.question));
 });

 it('flags conflicting answers on a shared prompt instead of silently accepting the collision', () => {
  const banks = clone(); const board = banks['category-board'][0], lightning = banks['lightning-quiz'][0];
  lightning.question = board.question; lightning.answer = 'إجابة مختلفة';
  expect(lightningBoardOverlaps(banks)).toEqual([
   { code: 'LIGHTNING_BOARD_CONFLICTING_ANSWER', ids: [board.id, lightning.id] },
  ]);
 });

 it('excludes draft, archived, inactive or wrong-locale questions from cross-game publication gate', () => {
  for (const change of [
   { status: 'ARCHIVED' }, { status: 'DRAFT' }, { categoryActive: false }, { locale: 'en-US' },
  ]) {
   const banks = clone();
   banks['lightning-quiz'][0] = { ...banks['lightning-quiz'][0], question: banks['category-board'][0].question, ...change };
   expect(lightningBoardOverlaps(banks)).toEqual([]);
  }
  for (const change of [{ status: 'ARCHIVED' }, { categoryActive: false }]) {
   const banks = clone();
   banks['category-board'][0] = { ...banks['category-board'][0], ...change };
   banks['lightning-quiz'][0].question = banks['category-board'][0].question;
   expect(lightningBoardOverlaps(banks)).toEqual([]);
  }
 });

 it('allows two distinct prompts with the same factual answer', () => {
  const banks = clone();
  banks['lightning-quiz'][0].answer = banks['category-board'][0].answer;
  expect(lightningBoardOverlaps(banks)).toEqual([]);
 });

 it('does not alter any source questions, statuses or snapshots during audit', () => {
  const banks = clone(), before = JSON.stringify(banks);
  lightningBoardOverlaps(banks); auditContent(banks);
  expect(JSON.stringify(banks)).toBe(before);
 });
});
