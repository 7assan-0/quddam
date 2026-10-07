import { beforeEach, expect, it, vi } from 'vitest';
import { tokenHash } from '@/lib/auth/crypto';
import { beginVoting, initialState, type SocialState } from './module';
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/billing/credits', () => ({ consumeGameCredit: vi.fn() }));
vi.mock('@/lib/analytics/events', () => ({ recordEvent: vi.fn() }));
import { applySocialCommand } from './service';
const token = 'a'.repeat(43), actor = { kind: 'PLAYER' as const, token };
let session: ReturnType<typeof fixture>, receipts: { payloadHash: string }[], tx: ReturnType<typeof client>;
const action = { type: 'SUBMIT_VOTE' as const, roundId: 'round-1', ballot: 1, targetId: 'p1' };
function fixture() { return { id: 'game', hostId: 'host', gameType: { slug: 'out-of-the-loop' }, stateVersion: 7, currentRoundNumber: 1, status: 'IN_PROGRESS',
 state: { ...beginVoting({ ...initialState(30), phase: 'DISCUSSION' }), candidates: ['p0', 'p1', 'p2'] } as SocialState,
 room: { sessionId: 'game', code: 'ABCDEF', expiresAt: new Date(Date.now() + 100000) }, socialParticipants: [{ id: 'p0', sessionId: 'game', tokenHash: tokenHash(token), position: 0, name: 'أ' }, { id: 'p1', sessionId: 'game', tokenHash: 'other', position: 1, name: 'ب' }],
 socialRounds: [{ id: 'round-1', outsiderId: 'p1', wordSnapshot: 'سري', guess: null, votes: [] }], displayAccesses: [] }; }
function client() { return { $queryRaw: vi.fn(), gameSession: { findUnique: vi.fn(async () => session), updateMany: vi.fn(async ({ data }: { data: { state: SocialState } }) => { session.state = data.state; session.stateVersion++; return { count: 1 }; }) },
 gameCommand: { findUnique: vi.fn(async () => receipts[0] ?? null), create: vi.fn(async ({ data }: { data: { payloadHash: string } }) => { receipts.push(data); }) },
 socialVote: { upsert: vi.fn(), findUnique: vi.fn(async () => null), findMany: vi.fn(async () => [{ targetId: 'p1' }]) }, socialRound: { update: vi.fn() } }; }
beforeEach(() => { session = fixture(); receipts = []; tx = client(); mocks.db.mockReturnValue({ ...tx, $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx) }); });
const send = (a = action, version = session.stateVersion) => applySocialCommand('game', actor, 'key', version, a);
function noWrites() { expect(tx.gameCommand.create).not.toHaveBeenCalled(); expect(tx.socialVote.upsert).not.toHaveBeenCalled(); expect(tx.gameSession.updateMany).not.toHaveBeenCalled(); expect(tx.socialRound.update).not.toHaveBeenCalled(); }
it('wrong round fails inside locked authorization before receipt lookup or any writes', async () => { const before = structuredClone(session); await expect(send({ ...action, roundId: 'other-round' })).rejects.toMatchObject({ status: 409, code: 'STALE_ROUND' }); noWrites(); expect(tx.gameCommand.findUnique).not.toHaveBeenCalled(); expect(tx.$queryRaw).toHaveBeenCalledTimes(2); expect(session).toEqual(before); });
it('old round with a rebased current version still fails without mutation', async () => { session.socialRounds[0].id = 'round-2'; session.currentRoundNumber = 2; session.stateVersion = 99; const before = structuredClone(session); await expect(send()).rejects.toMatchObject({ code: 'STALE_ROUND' }); noWrites(); expect(session).toEqual(before); });
it('a previously successful old-round key is not recovered into rematch', async () => { await send(); session.socialRounds[0].id = 'round-2'; vi.clearAllMocks(); await expect(send(action, 7)).rejects.toMatchObject({ code: 'STALE_ROUND' }); noWrites(); });
it('wrong ballot fails before writes', async () => { await expect(send({ ...action, ballot: 2 })).rejects.toMatchObject({ code: 'STALE_VOTE_INTENT' }); noWrites(); });
it('duplicate committed same-round vote returns one receipt and no second vote', async () => { const first = await send(); const second = await send(action, 7); expect(first.duplicate).toBe(false); expect(second.duplicate).toBe(true); expect(receipts).toHaveLength(1); expect(tx.socialVote.upsert).toHaveBeenCalledTimes(1); expect(session.stateVersion).toBe(8); });
it('duplicate receipt remains recoverable after same-round ballot resolution', async () => { await send(); session.state.phase = 'RUNOFF_VOTING'; session.state.ballot = 2; expect((await send(action, 7)).duplicate).toBe(true); expect(tx.socialVote.upsert).toHaveBeenCalledTimes(1); });
it('vote projection exposes only own vote; no secret, outsider or partial tally', async () => { const result = await send(); expect(result.session.roundId).toBe('round-1'); expect(result.session.tally).toBeNull(); expect(result.session.reveal).toBeNull(); expect(JSON.stringify(result.session)).not.toContain('outsiderId'); expect(result.session.voteCount).toBe(0); });
