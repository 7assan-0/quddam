# Board36 entertainment expansion — seven 96-question draft packs (19 Oct 2026)

**Authoring is not publication.** All seven packs below are original, text-only editorial **candidates** in `prisma/board-expansion`, not independently approved, not seeded, and not imported into `sourceBanks()`, the Board36 runtime, player databases, other games, payment flow, or Vercel.

| Category | Slug | Candidate items | Subject/format |
|---|---|---:|---|
| الأفلام | movies | 96 | identify movie by premise, director credits, historical award year |
| المسلسلات | series | 96 | identify series by premise, named creators, first aired year and specific role/actor credits |
| الألعاب | games | 96 | gameplay concept, original developing studio, explicitly-versioned release years |
| السيارات | cars | 96 | common components, make/model ownership, stable mechanics and technical vocabulary |
| المشاهير | people | 96 | **direct single factual question** about known public figures; some Saudi and Arab representation |
| الألغاز | riddles | 96 | **self-contained text, math and logic riddles** with explicit constraints; no picture rebus |
| من أنا؟ | who-am-i | 96 | **three separate first-person clues** per item; answer can be person, city, landmark, animal, concept, etc., not direct trivia |
| **Total** | | **672** | 32 at 200, 32 at 400, 32 at 600 per category |

All 672 questions and their stable draft IDs are synchronized in `content-review/2026-10-19/Board_Entertainment_7x96_Review.csv`; status **PENDING_INDEPENDENT_FACTCHECK / PENDING_INDEPENDENT_ITEM_REVIEW / NOT_RUN blind pilot**. Category-level URLs are starting points for independent reviewers, not certifications of individual assertions. Alternate spoken and transliterated answers must be checked before approval. Film, TV, games and car questions need original-studio/version/year/credited-creator context checked individually. Named media or brand references here are textual trivia; **no logos, posters, film frames or gameplay screenshots** have been shipped or copied.

## QA and nonactivation

`src/lib/content/board-entertainment-7x96.test.ts` enforces seven unique packs; 32 per grade; every row matches the 672-record ledger; direct-people vs three-clue WhoAmI format; normalized exact duplicate prompts against all baseline/draft question pools; no long answer directly included in its own prompt; no runtime/shared seed import. These automated checks are useful but **do not prove that facts, all alternative answers, difficulty, fun factor, near-duplicates or media rights are correct**. Real-player blind pilot and an independent editorial reviewer remain required.

The prior baseline source has 6 × 96 = **576** items. Geography96 + Currencies96 + Knowledge7×96 + Entertainment7×96 contribute **1,536 more authored but unapproved, unseeded items**. Total authored across 22 candidate category packs = **2,112**. Five visually distinctive categories remain: **الشعارات، خمن الصورة، أعلام دول، أمثال، خرائط**, target **480** more authored items before reaching **27 × 96 = 2,592**. Per-match board remains exactly six chosen categories and 36 cells.

## Editorial hold list

- **Films**: distinguish film's release year from Academy ceremony year; film story hints and translations must identify a single title; older ceremony facts need Oscar source check.
- **Series**: distinguish original UK/US versions, episode-premiere region/year, co-creator credits; challenge monotony of repeated date or studio formats.
- **Games**: distinguish early access, original, console regional and full release. Studio/developer versus publisher needs precision.
- **Cars**: technical names need accepted Arabic alternatives; manufacturer make versus distributor/badge and generation/year need review. Exclude fluctuating sale prices or ungrounded current availability.
- **People**: direct works/achievements must be independently sourced, and names accepted in verified transliterations; no unrelated personal data.
- **Riddles**: re-solve every calculation by a separate reviewer, rule out second valid answers; do not treat arithmetic correctness as blind evidence of a fun or difficult riddle.
- **WhoAmI**: each three-hint combination must identify one intended answer, not leak the name or accidentally describe a second entity; use independent player calibration.
- **All seven**: mark each CSV line APPROVE/REVISE/REJECT with real editor and date, update the source & CSV atomically, keep exactly 32 approved items per point tier, then run complete PG17 and real Chrome/user-experience/security approval in a separate controlled import PR. **No auto-merge or production activation.**

Status: `AUTHORED_672_PENDING_INDEPENDENT_REVIEW_AND_REAL_PILOT`.
