# Night MVP storage and safe rollback

The additive migration `20261015210000_night_mvp` creates only `NightSession`, `NightGame`, and `NightCommand`, their indexes/constraints, and two audit-protection trigger functions. It does not update existing game, user, wallet, credit, payment, or historical migration rows. Generate the Prisma client before typecheck/build. Apply migrations only to an explicitly approved database; the MVP acceptance procedure uses a newly created, isolated synthetic PostgreSQL database.

`NightSession` stores the owner, creation retry key/hash, versioned series state, and preparation/playing/completed/ended phase. Each ordered `NightGame` links at most one child session and preserves the exact two-team mapping. A verified completion writes one source-version/state-inventory digest and immutable receipt. `NightCommand` stores immutable accepted command keys/hashes. Creation retries are serialized by a transaction advisory lock; commands lock Night first, then the child session. Creating/linking a child is one database transaction. No Night operation starts a child game or consumes/refunds credits.

## Normal application rollback

1. Set `ENABLE_NIGHT_OF_QUDDAM=false` (or remove it), including every application process; the feature is disabled by default. Verify `/night` and `/api/night` are unavailable and child host pages omit the Night return link.
2. Return to the preceding application build, leaving the additive tables and records intact. Standalone game engines continue using their existing paths and financial behavior. No schema rollback is required.
3. Retain Night commands, mappings, and accepted receipts for an approved forward fix. Do not remove triggers, change a stored receipt, manually adjust totals, or detach a linked child to force a retry. There is no automatic correction/disposition or deletion endpoint in this MVP.

Turning off Night does not abandon, complete, refund, or otherwise mutate a child game. A game already started follows the original game controls and existing credit policy. Returning later to a hold-aware Night build resumes persisted state; re-importing an altered/rematched source fails verification and cannot change an accepted result.

## Empty-experiment schema rollback only

The following is a reviewable down procedure for a database proven to contain **zero Night records**, with all application writers stopped and the feature disabled. It has not been executed against production. If records exist, the guard aborts the transaction; use the application rollback above. Do not delete records to satisfy the guard. A database owner must separately reconcile migration history and regenerate a matching older Prisma client before bringing writers back; this file is not an instruction to modify production.

```sql
BEGIN;
LOCK TABLE "NightSession", "NightGame", "NightCommand" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "NightSession")
     OR EXISTS (SELECT 1 FROM "NightGame")
     OR EXISTS (SELECT 1 FROM "NightCommand") THEN
    RAISE EXCEPTION 'Retain Night audit records: use feature-off application rollback';
  END IF;
END $$;
DROP TABLE "NightCommand";
DROP TABLE "NightGame";
DROP TABLE "NightSession";
DROP FUNCTION night_command_immutable();
DROP FUNCTION night_game_immutable();
COMMIT;
```

## Retention and ownership boundary

The new owner/child foreign keys use `RESTRICT`, and accepted audit rows cannot be deleted or rewritten by application code. Existing `GameSession.hostId` and credit/history relations already restrict deletion for many account histories; a newly prepared Night can now also retain an owner before a child game exists. No account erasure workflow is introduced here. Retention, export, pseudonymization, and audited correction/deletion policy require explicit review before real customer exposure. Team names are stored in series state and immutable child mappings; do not use real personal information in acceptance fixtures.

The owner is authenticated by the existing server session, never by a client-supplied host or team ID. Night views disclose only selected titles, stable team names/IDs, child host links, safe completion status, placements, normalized points, and totals. Private engine state, answers, snapshots, credentials, and receipt internals are not returned. These are host-judged party games: a server-verified result proves canonical completion/identity, not independent competitive fairness.
