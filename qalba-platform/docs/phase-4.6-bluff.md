# Phase 4.6 — صدّقني

Dedicated module: `src/lib/games/bluff`. The library opens `/bluff/new` and the new controller routes. The earlier generic `/games/bluff/new` route and persisted generic sessions remain compatible; no earlier game engine or test is changed.

## Rules

3–12 phone participants, recommended 4–8. Five rounds. Submissions: 45 seconds; voting: 30 seconds. One fake and one immutable vote per participant per round. Own fake cannot be selected. Correct selection: +2; each opponent selecting your fake: +1. No points are invented for absent inputs. Highest score wins; all players sharing the highest score remain tied winners.

Published questions are selected server-side, snapshotted, unique in the match, and preferentially excluded from the host's last 50 selected questions. Rematch preserves participant identities/order, resets scores, and selects fresh snapshots. It is free within the same GameSession; the first Start consumes one existing platform credit.

## Phases and deadlines

LOBBY → ROUND_INTRO → FAKE_SUBMISSION → VOTING → REVEAL → ROUND_RESULTS → ROUND_INTRO (next round) / FINAL_RESULTS → COMPLETED.

Host can pause/resume active stages or abandon. Early end keeps previously earned scores and does not expose or score an unfinished question.

Host may close submissions early for moderation, then begin voting. Closed submissions retain the original submission deadline; expiration automatically starts voting even if the Host does nothing. Voting can close when everyone has voted or its deadline expires. Authorized views/SSE and commands resolve elapsed deadlines in a locked transaction. The room does not wait for missing/disconnected participants.

Pause stores server-calculated remaining milliseconds and clears the active deadline. Resume creates a deadline from server time plus that remaining time. Browser countdowns use a sampled server-time offset; neither submissions nor scoring use a device clock.

When every browser is offline there is no always-running background scheduler. The next authorized request resolves the expired stage; an active Host, TV or phone SSE resolves it without client polling. Voting receives its full 30-second window when the server opens that stage.

## Private information

Truth, accepted alternatives, immutable snapshots, fake ownership and votes are stored in dedicated tables, outside GameSession.state. Host/TV/player projections are explicitly assembled and never return raw rows.

While accepting submissions, Host and TV receive only the question and aggregate progress. A player receives only their own submission/status. After manual closure the Host has an anonymous moderation queue (answer ID + text) solely to remove inappropriate content before voting; it contains no truth or author IDs. TV never receives this queue.

During voting, public options contain only randomly generated UUID choice IDs and text. One option is the truth, with no distinguishing flag. Only a player's private projection includes their own option ID and their own selected option. Host/TV do not receive vote identities. After a scored reveal, truth, fake authors, voters and score breakdown become public.

React renders user text as text, never HTML. Text is bounded to 160 characters and rejects control/bidi-override characters. Normalization strips Arabic diacritics/tatweel, trims/collapses spaces, normalizes common alif forms and alif maqsura; it does not conflate ta marbuta with ha, erase consonant dots or fuzzy-match unrelated answers. Matching truth/alternatives and duplicate fakes share the same private response.

Participant credentials: 32 cryptographic random bytes, hash stored in the DB, HTTP-only SameSite=Lax secure-production cookie scoped to a session name. A reconnect cannot select a participant ID. Lobby removal deletes the credential record and renumbers positions; after Start participant removal is forbidden. Joined players stay in historical rounds even if disconnected.

## Mutation integrity

GameSession row lock, transaction, conditional actual-version update, unique GameCommand receipt. Hash binds the actor identity and validated action. Same key/action is duplicate success; changing action with that key is COMMAND_KEY_REUSED. Host requires exact expectedVersion. Private inputs may rebase across other participants' accepted inputs only in the same current round and legal phase; they still reject future versions, past-round IDs, duplicate own input and expired deadlines.

Database constraints make round/player fake and vote unique, and round/normalized fake unique. Fisher–Yates uses node:crypto.randomInt; options receive cryptographic UUIDs. Exactly-once scoring writes one BluffScore and one generic ScoreEvent per player/round and marks scoredAt in the same transaction. Timeout and last-input races share the lock.

Undo is intentionally limited to reopening manually closed submissions, before options have been published and before the deadline. It keeps already submitted answers and the original deadline, and discards the unpublished mixed choices. Moderation locks that Undo. Once voting choices are published, the game cannot return to submissions. Once truth/ownership is revealed, it cannot return to voting. No score or post-reveal time travel exists.

## Infrastructure and content

DisplayAccess reuses hashed platform tokens, TTL/completed grace, canonical active-link and window limits, QR and revocation. TV is read-only. SSE reauthorizes each audience, sends only its projection, issues heartbeat comments, resolves deadlines, and ends access on revocation. Browser fallback polling occurs only after SSE disconnection and stops on reconnection.

Eight BLUFF_* analytics names are added to the existing allow list. Payloads contain only existing internal identifier fields, never fake text, truth, author mappings or vote targets. lastEvent holds controlled event names only.

Admin: `/admin/bluff-questions`, create/edit/archive/search/category/difficulty/status filters, accepted alternatives, optional explanation. Normalized question has a unique DB constraint. Published content requires an active category. Admin edits do not change selected snapshots. Configurable moderation list uses the existing FeatureFlag model; Host hiding is retained in BluffModerationAudit. There is no ML moderation or CSV import in this phase.

Starter bank: 156 original Arabic prompts, 12 per category across 13 categories. Some deliberately approachable questions complement less familiar facts. Facts requiring verification were checked against primary sources; wording and question layout were written for Qalba.

Primary fact references: NASA Venus and Olympus Mons facts; Smithsonian Ocean cephalopods; UNESCO At-Turaif (2010); Kew saffron/vanilla; Pixar Toy Story history; British Museum Rosetta Stone. This is a fact-reference list, not an imported quiz list.
