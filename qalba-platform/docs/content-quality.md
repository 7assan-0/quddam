# Launch content validation — Phase 5.0G-1

This is an editorial/content boundary, not a change to answer matching, timers,
scoring, credit rules, tokens, projections, or game selection architecture.

## Repeatable release check

`npm run content:validate -- --output content-audit.json`

By default this validates authored seed definitions **and** the configured
PostgreSQL bank. DATABASE_URL is required. It performs no writes. To explicitly
validate definitions only use `--source-only`; this is not database evidence.
Blocking errors exit 1; warnings exit 0 and remain in structured output.
The command reads authored bank models only, never live secrets, votes, tokens,
users, or financial records. Reports contain IDs/counts/codes, not authored
answer text or private session payloads. It is an offline bank scan, not an SSE
or game-loop task. Run it before publishing content/releasing a content import.

## Checks and editorial responsibility

Existing per-game Zod/engine structural validators are reused, not replaced.
Additional authored text checks reject clear placeholders, replacement encoding,
control characters, HTML tags and code fences. Editorial Arabic keys strip the
existing common diacritics/Alef variants/tatweel and normalize whitespace/NFC;
ta marbuta is **not** merged with ha. Keys are used for duplicate review, never
for a new gameplay matcher. Duplicate prompts and conflicting canonical answers
are blocking. Ordering instruction plus canonical item sequence catches clones
hidden by different titles. Original repeated Court framing instructions and
facts are intentional; case premises are distinct. Cross-game reuse of common
knowledge is intentional because games have different mechanics.

Letter questions keep the engine's first-letter test for canonical answers and
all aliases. Survey options/ranks/weights, Forbidden collisions, Ranked
rank/entry uniqueness and Ordering identity/position rules remain authoritative.
The validator also checks the seeded astronomical/decimal-prefix ordering and
arithmetic/dated synthetic sequences. Other authored ordering criteria require
editorial review; arbitrary real-world correctness cannot be inferred from a
schema. No automated classifier claims universal factual or safety correctness.
No runtime external web dependency is introduced.

## Eligibility and capacity

Published + active category + existing language/locale requirements count as
launch eligible. Nonpublished and inactive data remain for history but do not
count. Category Board needs six complete 200/400/600 buckets. Letter's unchanged
generator needs >=5 letters with >=8 questions each and >=25 total questions;
launch definitions have ten letters with ten questions each. The other default
minima are Social 1, Survey 5, Forbidden 30, Bluff 5, Ranked 5, Lightning 15,
Ordering 7 and Court 5. Forbidden is a timed deck, so cards used per real match
vary; 30 is the existing engine bank floor, not a claimed fixed consumption.
Recent-content preference is generally soft across rematches; repetition is not
promised to be impossible. Ordering remains a WARN for 60 alphabetical variants
in a 170 eligible bank. It still has numerical, fictional dated, duration,
planetary and SI-prefix content and easily supports a full match/rematch.

## Existing deployments and reviewed corrections

`npm run content:remediate` is a dry run. `npm run content:remediate -- --apply`
performs only the versioned reviewed patches, archives ten duplicate Ordering
IDs, and corrects exact former seed metadata labels. It locks each target row,
checks original authored fields/items before changing them, and skips later
editorial edits rather than overwriting. Inspect skippedEdited before claiming
an existing deployment is clean. Run content:validate after applying. Repeating
is harmless. No source array is reordered; IDs/history/snapshots are retained.
The script does not edit active matches, uses, votes, scores or financial rows.
Seed upserts still preserve existing bank rows/status and category activation;
existing accounts now also remain untouched on reseed. This narrow guard is
required for content rollout and is not a replacement for the bootstrap runbook.

## Factual review references

Review date 2026-10-06. Stable school-level mathematics/vocabulary/fictional party
prompts were reviewed internally. The following primary references were checked
for the corresponding factual groups (not represented as proof for unrelated
questions):

- NASA planet diameters/order: https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/
- NASA Venus rotation/orbit: https://science.nasa.gov/venus/venus-facts/
- SI units/prefixes: https://www.bipm.org/en/si-base-units/ampere and https://www.bipm.org/en/measurement-units/si-prefixes/
- UNESCO At-Turaif 2010: https://whc.unesco.org/en/list/1329
- UNESCO Al-Ahsa 2018: https://whc.unesco.org/en/decisions/7129
- IFAB penalty definition: https://www.theifab.com/laws/latest/the-penalty-kick/
- Apollo 11 mission: https://www.nasa.gov/mission/apollo-11/

Survey weights are authored party-game weights, not scientific polling.
Ranked lists are explicitly curated editorial rankings, not sales/popularity
claims. Court scenarios are fictional general-audience social disagreements.
No source correction rewrites an already selected immutable snapshot.

## Rollout

Validate definitions and the current bank, review aggregate results, run the
reviewed remediation in dry-run mode, apply the small reviewed patch set, then
validate again. Keep backups for operational recovery. Archived rows can be
restored editorially if needed; deleted data is not part of this procedure.
Use existing admin/import APIs; critical structures are validated there before
writes. The generic question CSV keeps its existing transport/row limits and
all-or-nothing publication behavior. No new importer or CMS is added.
