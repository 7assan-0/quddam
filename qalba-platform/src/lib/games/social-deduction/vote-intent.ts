import type { SocialAction, SocialView } from './service';
export type SocialVoteIntent = Extract<SocialAction, { type: 'SUBMIT_VOTE' }>;
export function sameVoteBoundary(action: SocialVoteIntent, originalPhase: SocialView['phase'], fresh: Pick<SocialView, 'roundId' | 'phase' | 'ballot'>) {
 return fresh.roundId === action.roundId && fresh.phase === originalPhase && fresh.ballot === action.ballot;
}
