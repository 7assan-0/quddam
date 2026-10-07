import { expect, it } from 'vitest';
import { sameVoteBoundary } from './vote-intent';
import { socialCommandSchema } from './validation';
const vote = { type: 'SUBMIT_VOTE' as const, roundId: 'immutable-round', ballot: 1, targetId: 'target' };
const input = { key: '00000000-0000-4000-8000-000000000001', expectedVersion: 10, action: vote };
it('vote envelope retains immutable round and ballot identity', () => { expect(socialCommandSchema.parse(input).action).toEqual(vote); });
it.each([{ roundId: undefined }, { roundId: '' }, { roundId: 'a'.repeat(101) }, { ballot: undefined }, { ballot: 0 }, { ballot: 1.5 }])('incomplete/malformed vote identity fails closed: %j', change => { expect(socialCommandSchema.safeParse({ ...input, action: { ...vote, ...change } }).success).toBe(false); });
it('same round/phase/ballot permits retry after other voters advance the version', () => { expect(sameVoteBoundary(vote, 'VOTING', { roundId: vote.roundId, phase: 'VOTING', ballot: 1 })).toBe(true); });
it.each([
 { roundId: 'rematch-round', phase: 'VOTING' as const, ballot: 1 },
 { roundId: 'next-round', phase: 'VOTING' as const, ballot: 1 },
 { roundId: vote.roundId, phase: 'RUNOFF_VOTING' as const, ballot: 2 },
 { roundId: vote.roundId, phase: 'PAUSED' as const, ballot: 1 },
])('changed boundary cannot translate an old vote: %j', fresh => { expect(sameVoteBoundary(vote, 'VOTING', fresh)).toBe(false); });
it('non-vote command envelopes keep their existing contract', () => { expect(socialCommandSchema.parse({ ...input, action: { type: 'START' } }).action).toEqual({ type: 'START' }); });
