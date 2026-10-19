# Board36 Currencies96 — candidate editorial audit / NOT FOR PLAY (18 Oct 2026)

**Commit-isolated editorial source:** `prisma/board-expansion/currencies-candidate.ts`.
**Item review:** `content-review/2026-10-18/Board_Currencies_96_Review.csv`.
**Release status:** DRAFT / NO-GO. Owner has approved **category name** عملات but has not approved these 96 item answers, graded difficulty, alternate accepted forms or illustrations. No runtime or DB seeding connection is made.

## Authored scope and constraints

- 96 authored text-only question/answer pairs in 3 sections: **32 at 200**, **32 at 400**, **32 at 600**.
- 200: named national currencies, including **Saudi riyal**, other Gulf currencies, and globally familiar currencies. Contextual labels distinguish dinars, dollars, and riyals.
- 400: identify **ISO 4217 alphabetic code** for another 32 countries.
- 600: identify less familiar currency names given the issuer and ISO code; difficulty is an *editorial assumption*, **NOT real blind-calibrated evidence**.
- Questions freeze reference to **October 2026**, not relative “current/today” or changing exchange rates.
- The initial source is intentionally text-only: **no actual licensed banknote/coin assets have been acquired or shipped**. For a visual edition, replace reviewed items in a separate PR after provenance, rights, artwork, alt text, mobile image readability and ambiguity QA; keep tier quotas and original question IDs stable once activated. Never represent a mock illustration as an actual issued banknote.
- Proposed answer variants in the CSV are **unapproved suggestions**, not accepted answers. Country context must disambiguate lookalike symbols, shared names (dollar, rial, dinar, rupee), and transliteration.

## Fact references to use per item — not a blanket certification

1. SIX Group is the **official ISO 4217 maintenance agency**, and makes current list and change notices available:
   https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html
2. Readable country/currency/code index with published 30 July 2026 update:
   https://www.iban.com/currency-codes
3. Saudi Central Bank / SAMA sixth issue, including legal names and examples:
   https://sama.gov.sa/en-US/Currency/Pages/SixthIssue.aspx
4. ECB confirms euro adoption by Bulgaria as of 1 Jan 2026 (avoid outdated BGN-as-current questions):
   https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.pr260101~c830245e42.en.html

Special checks for reviewers: SLE is Sierra Leone's present ISO code (not old SLL), “رييل” spelling for Cambodian riel, “الروبية الإندونيسية” Rupiah vs subcontinent Rupee, Brazilian **real** vs Saudi **riyal**, and Arabic variant spellings for Tugrik, Ngultrum, Pa'anga, Quetzal. Check each line against the actual SIX current list and, where needed, an issuing central bank; a shared source URL alone is not a human source verification. Review all currency validity/changeover dates at signoff. Source citations must not be hallucinated.

## Honest current arithmetic

- Approved **27 category names** = 22 retained + 5 new, ألغاز exactly once.
- **576** baseline Board questions on source-only PR #43; **96** Geography drafts, **96** Currencies drafts, and **672** questions across seven new category drafts: **2,112 candidate authored questions** total (after the additional 672-item entertainment batch; see docs/board-entertainment-7x96-quality-gate-20261019.md).
- **Only baseline 576** are imported by `core-content.ts`, `sourceBanks()`, and candidate synthetic PG17 seed. The new 1,536 remain isolated, not playable or published.
- Five visual-oriented category banks are not authored to 96 each = **480 questions** further to author to reach final 27 × 96 = **2,592**. The geography and currency candidate packs themselves still require full factual/editorial quality, alternate-answer and empirical difficulty signoff.
- Each Board match stays exactly 6 selectable eligible categories × 6 questions = **36 cells**. Nothing in this PR changes gameplay, billing, other games, or shared seeded category rows.

## Required before a production-ready Currency96 import

1. Independent line-by-line `APPROVE/REVISE/REJECT` for all 96: exact currency/issuer/code checked against authoritative primary material, acceptable spoken forms/translation, ambiguities, legal reference date.
2. Blind group difficulty calibration and grade reassignment/replacement preserving 32 per level; unverified “hard” claims are not evidence.
3. Add original or appropriately licensed banknote/coin image questions only with provenance and legal checks; otherwise accurately market content as a text/ISO-currency round.
4. Independent accessibility/RTL/44px/mobile and answers-hidden-until-reveal QA if visual questions are imported; question ID stability, replay, rematch and 36-cell game regression.
5. Fresh exact-head full Vitest, type, lint, build, content source QA and *empty synthetic PostgreSQL 17* seed/reseed; security review (including outstanding braces) and explicit owner signoff. Do not import into shared global seeds, merge to main, deploy to Vercel or touch customer DB merely because CI is green.

**Status: AUTHORED_CANDIDATE_96_PENDING_INDEPENDENT_ITEM_REVIEW_AND_REAL_PILOT**.
