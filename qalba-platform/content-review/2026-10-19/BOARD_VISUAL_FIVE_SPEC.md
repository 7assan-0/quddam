# Quddam visual-five editorial specification — DRAFT
Base: Board27 PR #48 at 9d1e9f758d8a0f6abe3c9cca528d6b1d3feda584.
Scope: خمن الصورة، أعلام الدول، الأمثال، الخرائط، الشعارات. 96 original items/category; 32 each at 200,400,600; 480 total. REVIEW ONLY. No runtime import, seed, asset deployment or claim of factual signoff.

## Reference policy
YouTube is a format/creative reference, not a source of licensed image assets or factual truth. Record video title, creator, URL, relevant timestamp, inspiration note, and independently verified factual source for every question. Never reproduce creator artwork or questions verbatim. Each image must be original, commissioned or license-verified with asset attribution and usage rights recorded. Do not assert a YouTube video was inspected without recording evidence.

## Category contracts
- Visual rebus: 2, 3, 4+ images and optional symbols/letters; composed answer unambiguous in Arabic; e.g. صوم + مال = صومال is an owner-supplied format example, not copied asset. Reject dialect-dependent or phonologically invalid decomposition. No answer text in artwork.
- Flags: sovereign country identification, distinguish similar flags via visible features; use authoritative official national or governmental flag references; accessible descriptions must not leak answers during play.
- Proverbs: original illustration of a recognized Arabic proverb; canonical phrase plus genuinely equivalent accepted variants; source the wording, reject loosely related sayings.
- Maps: outline, location, borders, region/country/city as explicitly framed; geographic claims independently checked, no disputed borders presented as uncontested.
- Logos: Saudi and international balanced representation; obtain permitted original/licensed brand assets, confirm current/historical version and trademark attribution; do not imply endorsement.

## Difficulty acceptance
200: widely recognizable and visually direct. 400: two-step inference or moderately familiar reference. 600: genuinely harder but solvable from sufficient visual clues; never difficulty through tiny images, obscure copyright-dependent references, or ambiguity. Blind two-group playtest and adjust based on observed correct rates, not assumed rates. Review mobile 360/390 and TV 1920; readable at normal scale; answer aliases verified.

## Required per-item fields
id,category,tier,prompt,canonical_answer,accepted_aliases,visual_brief,asset_path,asset_license,asset_attribution,youtube_creator,youtube_video_title,youtube_url,youtube_timestamp,inspiration_only,independent_fact_source_url,independent_fact_source_accessed_at,reviewer,review_status,ambiguity_notes,blind_pilot_status,blind_pilot_results.
Default statuses: PENDING and NOT_RUN. Reject empty source/license and unverifiable factual claims before publish. Reject duplicates within and across banks. Maintain 32/32/32 tier invariants.

## Release boundary
Do not add to sourceBanks, Prisma seed, global category selector or Vercel until all 480 items have verified art rights, independent fact and alternate-answer review, blind difficulty pilot, and exact-head synthetic PG17 + real Chromium UI/RTL/accessibility acceptance. Keep PR draft.
