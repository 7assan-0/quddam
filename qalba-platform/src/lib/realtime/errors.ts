import { HostAuthInvalidError } from '@/lib/auth/host-stream';
import { GameRuleError } from '@/lib/games/category-board/module';
import { SocialError } from '@/lib/games/social-deduction/module';
import { LetterError } from '@/lib/games/letter-network/module';
import { SurveyError } from '@/lib/games/survey-battle/module';
import { ForbiddenWordError } from '@/lib/games/forbidden-word/module';
import { BluffError } from '@/lib/games/bluff/module';
import { RankedError } from '@/lib/games/ranked/module';
import { LightningError } from '@/lib/games/lightning/module';
import { OrderingError } from '@/lib/games/ordering/module';
import { CourtError } from '@/lib/games/court/module';
import { RoomError } from '@/lib/rooms/service';
import { terminalAccessStatus } from './access-status';

export class RealtimeAccessError extends Error { constructor(public status: number) { super('Realtime access unavailable'); } }
export function classifyRealtimeError(error: unknown): 'TERMINAL' | 'TRANSIENT' {
  if (error instanceof HostAuthInvalidError) return 'TERMINAL';
  if ((error instanceof GameRuleError || error instanceof SocialError || error instanceof LetterError ||
       error instanceof SurveyError || error instanceof ForbiddenWordError || error instanceof BluffError ||
       error instanceof RankedError || error instanceof LightningError || error instanceof OrderingError ||
       error instanceof CourtError || error instanceof RoomError || error instanceof RealtimeAccessError) && terminalAccessStatus(error.status)) return 'TERMINAL';
  // Unknown/DB/serialization/pool errors are not evidence that access was revoked.
  return 'TRANSIENT';
}
