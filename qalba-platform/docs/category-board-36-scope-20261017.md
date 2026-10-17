# Category Board: agreed 36-cell match (2026-10-17)

Product direction supersedes the earlier 72-cell proposal; this branch is
stacked on Draft PR #17, without rewriting its historical test evidence.

**New matches:** exactly six selected categories, each with six independently
selectable tiles: 200×2, 400×2, 600×2. Total 36 distinct frozen question IDs.
The UI and read-only TV render all six columns and six tiles per column;
the host sends the exact cell key, not a category/value lookup with two matches.
Used tiles are disabled. Automatic completion requires all 36 completed tiles;
the host's explicit END_GAME continues to allow ending early. Credits, scores,
undo, session snapshots, guest authority and prior persisted 18-tile session
state are not migrated or retroactively rewritten.

**Seed bank:** the previous 36 original IDs remain unchanged. 36 additional
authored starter questions (two per tier/category) produce **72 source rows**:
4 distinct prompts per 200/400/600 tier in each of six categories. A new match
selects two separate IDs from each tier while preferring previously unplayed
host history. This is enough for a 36-question match and additional source
variation. It does **not** claim fulfillment of the separately requested
96-question editorial pool for each category (32 per tier, 576 total). The
content audit retains an explicit `BOARD_96_BANK_NOT_YET_READY` warning.

**Safety:** a category must have at least two eligible published rows in every
value bucket, and a session construction rejects duplicate tile keys, duplicate
question IDs, missing frozen question snapshots or incomplete distributions.
Seed uses `upsert update: {}`, so previously inserted rows and completed
games are preserved; do not point a test seed at production. Existing legacy
18-cell sessions can be reopened through their prior category/value command
shape; new 36-cell sessions require their exact key.

**Acceptance gates:** verify source content/duplicate checks; full unit
regression + lint/typecheck/build; synthetic fresh seed; browser check for
36 visible tiles and two independent 200-point cells; native guarded PG17
36-round full journey and five-mobile guest/capacity tests when the native
fixture is available. Do not inherit the historical 18-round PASS as proof of
the new 36-round match. No merge, release, billing or deployment without
separate approval.
