# Out of the Loop participant authorization and round snapshots

Phase 5.0B-3 changes only H02/H03. Rules, scoring, room lifetime (eight hours),
Host authentication/SSE, other games and billing are unchanged.

## Participant command linearization

Every player command first locks GameSession FOR UPDATE, validates the original
43-character token format, then locks its Room FOR SHARE. It rereads the session,
room and current participants while locked. The participant must exist in this
session, match the token hash, and the room must belong to this session and have
expiresAt strictly greater than Date.now() at authorization. Removal deletes the
SocialParticipant; no separate revocation/expiry field exists on that model.
The room expiry governs the credential. Nothing extends it.

Authorization runs before duplicate receipt lookup, receipt creation, version
checks or gameplay writes. Failed authorization throws and rolls back the entire
transaction. Existing session serialization also covers join/removal, stateVersion
and GameCommand semantics. A token from another session cannot authenticate even
if manually supplied under the current session's Cookie name. Cookie expiration
in a browser is not the security boundary. Commands authorized before expiry
linearize at that check; the room row cannot be concurrently changed/deleted
until the transaction completes. A command waiting for locks checks fresh time.

## Immutable authored data

SocialRound.wordSnapshot (varchar 100) and alternativesSnapshot (text array)
are required. snapshotOrigin distinguishes ROUND_CREATION from LEGACY_BANK_CAPTURE.
Only word text and accepted aliases are used for role cards/guess judging/reveal;
category and difficulty do not participate in the round rules. The existing
SecretWord ID remains an audit/selection reference, not a source of round content.

At START/REMATCH the unchanged selection policy picks an ID. The selected bank
row is locked FOR SHARE and reread; the text and aliases are copied in the same
transaction as round creation. Concurrent admin UPDATE either completes first
and the new authored values are captured, or waits for the snapshot transaction
and affects future rounds only. An archived/non-Arabic selected row is rejected
rather than starting with stale selection data. Reads and guessing never join
or read SecretWord for an existing round. A narrow database trigger forbids
updates to snapshot text, aliases or provenance; votes/results remain writable.

## Forward migration and legacy limitations

New migration 20261005190000_social_round_snapshot is additive; no old migration
was edited. Columns are initially nullable solely within migration, legacy rows
are captured once, and both snapshots become NOT NULL before migration completes.
There is no word/aliases default: new inserts must supply snapshots.

The old schema stored only SecretWordId, guessed text and outcome. It did not
store the original word/aliases in GameSession state, analytics or an authored
revision history. An original historical word edited before deployment therefore
cannot be reconstructed safely. The migration captures the current referenced
SecretWord values once and explicitly tags each old row LEGACY_BANK_CAPTURE.
This is a deterministic compatibility capture, **not** a claim that these are
the original historical values. Existing guesses, winners, endedAt and other
results are preserved exactly. It cannot repair a judgment already affected by
an earlier bank edit. Subsequent bank edits cannot change even those legacy
captures. No silent ongoing live-bank fallback, first-reader race or lazy mutation
is used. An orphan/null legacy bank value fails migration rather than inventing
content. Existing FK integrity normally prevents this condition.

Deploy with the standard migration/application maintenance boundary; the old
writer cannot create rounds once required columns exist. Deploy the compatible
application immediately with the migration. A backup and explicit review of
legacy capture provenance are appropriate. Migration does not rewrite outcomes.

## Privacy and history

Only existing authorized self.secretWord and post-result reveal.secretWord fields
use wordSnapshot. Snapshot fields and aliases are never spread into Host, TV,
participant, SSE, HTML/RSC or analytics payloads. Outsider self.secretWord remains
null; Host/TV receive no secret until existing reveal rules allow it. Historical
SocialRound rows retain immutable word/aliases after rematch. No new historical
API or UI is introduced.

## Verification

Focused service tests exercise authorization ordering, exact expiry boundary,
waiting across expiry, malformed/removed/foreign identity, duplicate keys, valid
commands, private projections and snapshot-only judging. Browser/database tests
exercise explicit Cookie headers for FINISH_TURN/SUBMIT_VOTE/SUBMIT_GUESS with full
before/after row evidence, room isolation, real admin edits, reconnect/reload,
original/new alias judging, results/history and future rematch content.

`node scripts/social-snapshot-migration-test.mjs` applies all prior migrations,
creates legacy rows, upgrades them and proves required/immutable fields while
preserving result updates. It uses PGlite PostgreSQL semantics, not a native
multi-connection PostgreSQL load/concurrency certification.
