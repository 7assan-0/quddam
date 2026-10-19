# Board content quality — first remediation delivery, 20 October 2026

**Review-only candidate. CONTENT_NO_GO and SECURITY_NO_GO remain.** This is a first implementation batch on PR48 source `15f9254af2deb36daa91d09b4c1b3af9500cc50f`, not completion of independent human review or difficulty calibration. No main merge, runtime activation, production database write, payment, or production deployment is part of this work.

## Completed in this batch

- **46 existing draft Q/A rows revised**, with their source ledgers synchronized: 33 entertainment changes, eight initial knowledge corrections, and five further duplicate/ambiguity corrections. Per-category quotas remain 96 and each numeric tier remains 32. The original 576 source rows and stable seed IDs are unchanged.
- **33 entertainment replacements:** eight each of Movies400, Cars400, Series600 and Games600, plus Movies600's former easy Snow White identification. Exact primary references and remaining concentration biases are recorded in [entertainment remediation](board-entertainment-remediation-20261020.md). Familiar character facts can still be too easy; no replacement has an empirical tier approval.
- **13 other edits:** the circular `animals-600-002` adaptation definition is replaced by an imprinting question; `culture-600-002/003` now distinguish UNESCO's Article17 urgent list and Article18 practices register; `sports-400-002/003` specify FIBA2024 shot-clock reset and indoor volleyball block exclusion; `sports-600-015/020/032` remove a self-answering Grand Slam count and clarify sabre hands exclusion and Axel forward-outside takeoff. `geo-draft-069/084` replace repeats of baseline contour-lines/Bering-Strait facts with salinity lines/Denmark Strait. `animals-200-031` replaces a second honey-bee clue with walrus identification. `riddles-400-014/020` state their recurrence rules explicitly instead of treating an arbitrary finite sequence as having a unique continuation.
- **Eight original visual rebus pilot items** with 16 original SVG panels, manifest, review ledger and responsive reveal/hide preview. These are a partial sample of one missing 96-item category; they are not eight complete banks or approved gameplay content. See [rebus preview](evidence/rebus-pilot-20261020/index.html) and [scope and pending gates](board-rebus-pilot-20261020.md). The 2,112-item inventory intentionally excludes these partial visual samples; five full visual banks are still incomplete.
- **A source-bound review tool for all 2,112 existing authored questions**, across 22 complete banks. It validates exact source-to-ledger matches, flags possible answer leaks/overlapping facts/missing item-level references, and exports an Arabic offline review dashboard with search, category/tier filters, source links, pagination and proposed reviewer decisions. Flags are triage candidates, not counts of proven errors. A repeated answer can legitimately describe different facts. No decision modifies the source ledger automatically.
- **A blind pilot preparation tool:** opaque question IDs, no answers or proposed tiers in participant packs, two anonymous groups and six distinct attempts per question. Blank judge forms remain `NOT_RUN`. Unknown/duplicate/stale/invalid-timing records are rejected; complete data still never grants automatic approval. A source/evidence/context change changes the content hash and invalidates previous decisions/responses. Reviewer pages and private rosters must never be given to blind participants.

## Source-specific notes for knowledge corrections

| Item | Reference and limitation |
|---|---|
| animals-600-002 | [Nobel1973 press release](https://www.nobelprize.org/prizes/medicine/1973/press-release/), [Max Planck learning/imprinting account](https://www.nobel.mpg.de/en/human-and-animal). Institutional indexed material checked; specialist Arabic terminology still pending. |
| culture-600-002/003 | [UNESCO listing procedure](https://ich.unesco.org/en/procedure-of-inscription-00809), [practices register](https://ich.unesco.org/en/select-for-the-register-00300), [Article18 explanation](https://ich.unesco.org/doc/src/06910-EN.pdf). Official indexed text supports the distinction; direct HTML access presented an anti-bot challenge. Independent full-record check remains required. |
| sports-400-002 | [FIBA2024 rules](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-v10a.pdf#page=34), Article29.2.7, ring contact and same-team recovery must both hold. The question explicitly specifies the edition. |
| sports-400-003 | [FIVB indoor basic rules](https://www.fivb.com/volleyball/the-game/basic-rules/), three team hits in addition to block contact; no claim about beach rules. |
| sports-600-015 | [WTA historical1988 account](https://www.wtatennis.com/news/2193996/graf-capriati-the-eight-gold-medal-singles-winners-in-modern-olympics). This is a fixed historical claim, not a time-sensitive claim about the only player ever. |
| sports-600-020 | [FIE technical target diagram/definition](https://static.fie.org/uploads/7/38636-10.2%20technical%20rules%20restructured%20ang.pdf), t.97. Older primary edition supports the exclusion; current-edition referee review is pending. |
| sports-600-032 | [ISU jump explanation](https://www.isu-skating.com/en/news/figure-skating-jumps-explained/), forward outside edge; both direction and edge side are required. |
| geo-draft-069/084 | [NOAA salinity glossary](https://tidesandcurrents.noaa.gov/glossary#isohaline), [NOAA primary oceanographic study](https://www.pmel.noaa.gov/pubs/outstand/aaga1235/results.shtml), Greenland–Iceland sill passage. |
| animals-200-031 | [Fisheries and Oceans Canada walrus description](https://www.dfo-mpo.gc.ca/fisheries-peches/ifmp-gmp/walrus-atl-morse/walrus-nunavut-morse-eng.html), prominent tusks and whiskers. |

References/variants/author notes are not independent reviewer signatures. All existing factual/editorial decisions remain PENDING; reviewer/date fields are blank and pilot statuses remain NOT_RUN.

## How to prepare an actual review session

From `qalba-platform`, after installing the unchanged lockfile:

```text
node --import tsx scripts/board-content-review.ts --export ../verification/board-review-20261020 P01 1
node --import tsx scripts/board-content-review.ts --analyze ../verification/board-review-20261020/judge-responses-EMPTY.csv
```

`review.html` contains questions and answers for reviewers. Give a participant only their `participant-P01-session-1.html`, which hides answers, tiers and original IDs. Participant answer exports require an actual facilitator to judge correctness and ambiguity; they are not automatically scored or approved. Keep response files outside Git and do not collect names/emails. Browser tests/simulations are never pilot evidence.

The complete preparation roster has **12 anonymous slots, 44 sessions of 24 questions per slot, 12,672 attempts total**. This is coverage planning, not recruitment or a validated experimental design. The workload is substantial: spread sessions, limit fatigue, and have a human experiment lead decide whether to expand cohorts or split category studies before collecting data. No participants have been recruited or messaged. No responses have been fabricated.

## Validation and remaining gates

- Local source/ledger quota and new review/rebus tests pass. Local full run on Windows: **1,570 passed /1,571 total**, 98/99 files pass. The unchanged native-PG17 fixture test requiring POSIX0600/0700 permissions stops at the permission guard on Windows instead of reaching its malformed-JSON expectation. Do not weaken that guard; Ubuntu CI must verify the full suite.
- Local TypeScript and production build pass using a synthetic loopback database URL that is not connected. ESLint has zero errors and two pre-existing unused-variable warnings. Next-generated import-only changes to `next-env.d.ts` were restored to committed bytes.
- Real Chrome desktop/mobile QA covers the rebus preview and review tooling; actual player correctness/difficulty data remains zero. The source-bound workflow exports a blank review package and proves its analysis is `NOT_RUN`.
- Fresh [security evidence](security-braces-review-20261020.md) still shows **7 high dependency entries from one braces advisory**; the production-only result is separately zero. No released compatible fix, audit suppression, downgrade, waiver or fork was adopted. New CI has a separate strict full-audit job so content QA success cannot imply overall security approval.
- Native empty PostgreSQL17 migration/576 seed/reseed and full tests must be observed on the exact new PR SHA. Prior PR48 green runs do not certify this delivery.

Next work: independent item-by-item primary-source/Arabic-variant review, semantic duplicate and diversity cleanup, actual blinded player responses, remaining visual authoring and rights/visual signoff, and a maintained compatible security resolution. Only then consider a separate activation candidate and final owner merge/deployment approval.
