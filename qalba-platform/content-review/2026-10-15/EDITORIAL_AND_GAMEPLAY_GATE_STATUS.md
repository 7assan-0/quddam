# Editorial and real-gameplay acceptance status — 2026-10-15

**Decision: NO-GO.** This is evidence for Draft PR #11 only. Owner approval of quality criteria is not a release/import/merge/deployment approval. Never infer success from a canceled or earlier-head CI run.

## Bluff / صدّقني: all 169 items have explicit item-level status

- Canonical refreshed review sheet: `Bluff_169_Item_Review_Gate_V2.csv`. It enumerates **156 original source questions + 13 staged candidate questions**, preserving each primary answer, alternatives, review state, source when available, heuristic overlap candidates and NO-GO state.
- **13/13 staged question primary facts** were compared against accessible subject-specific public material on 2026-10-15. Primary-reference corroboration is not certification of all answers/aliases, semantic independence or live-game fairness. Source links are retained per item; corrections made to Mohs (USGS specific scale page), the Arabic grammar lesson (working Al Jazeera route), and IATA (official 3-letter directory). The staged Libero source was updated to current FIVB rules. The staged Spyro question now says he is the playable protagonist.
- Two newly replaced original primary facts have source links: the chess stalemate definition at https://support.chess.com/en/articles/8557490-what-is-stalemate and CSS `font-size` at https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-size.
- **The other 154 original item rows do not yet carry individually verified, recorded reference links.** Do not imply that they passed complete item-by-item independent source or answer/alias approval. Original narwhal `حريش البحر` false alias removed; its revised `ناروال` transliteration still requires independent sign-off.
- Specific semantic replacements: original `bluff-seed-games-1` changed from the duplicated knight movement fact to stalemate/draw; original `bluff-seed-technology-4` changed from a duplicated CSS-language definition to the CSS font-size property; staged `bluff-supplement-technology-01` changed from repeated SMTP to DNS mail-exchanger (`MX`), backed by https://www.rfc-editor.org/rfc/rfc5321.html (sections 3.6 and 5). These are targeted content changes, not automatic approval to use staged data.
- Two original source changes are applied by a narrowly scoped explicit `prisma/seed.ts` upsert alongside the known narwhal alias fix. The disposable double seed and source tests must verify changes at the **latest SHA**.

## Semantic overlap

- Refreshed V2 sheet marks **34 heuristic same-answer and overlapping-topic cross-bank links** from the current Bluff sources against staged Board (1,296), Lightning (600) and Letter V4 (224). The number is a candidate count, **NOT 34 independently proven duplicates**. The heuristic misses synonyms, different primary answers that represent the same fact, and other game formats.
- Earlier exact normalized string regression checks Board, Lightning, Letter V4 and both Bluff banks. Semantic replacement decisions require reviewing what the question actually tests. Merely sharing the answer is insufficient evidence of duplication.
- Historical `Bluff_169_Item_Review_Gate.csv` is superseded by V2 for audit; do not rely on its old source text/candidate count.

## Court / المحكمة

- The source has 180 unique case texts and 180 prosecution/rebuttal prompts, and no original universal scenario question ending.
- `Court_180_Individual_Editorial_Gate.csv` is the historical first-pass ledger. Current `Court_180_Individual_Editorial_Gate_V2.csv` enumerates all 180 separately. Removed the universal, unsupported assertion that no detailed prior agreement existed; each case now retains a fictional-context fact and a distinct action grounded in its own scenario. Added source/ledger regression guards and an isolated PostgreSQL double-seed assertion of 360 case-fact rows, zero old blanket facts, and 180 distinct action facts. **This corrects a repeated source assumption; all 180 still require human case-by-case editorial/defense balance assessment and actual juror playtest.**
- Before approval, test at least one full host/guest/juror browser path against a disposable database and retain native logs; it is not a human judgment of whether the prompts are fun or impartial.

## Forbidden Word / الكلمة الممنوعة

- `Forbidden_13_Hard_Candidates_Review_Pending.csv`: 13 provisional HARD cards, one per existing category, all have four unique restricted terms. Not imported.
- `Forbidden_13_Hard_Playtest_Gate.csv`: a separate candidate-clue and risk checklist per card. The 13 suggested clue texts have **zero exact forbidden-term substrings** after Arabic normalization; this does not certify dialectal variants, synonyms, semantic paraphrases, oral delivery or correct difficulty.
- A human playing-team exercise must assess clue fairness, guessing, timing and inappropriate synonym leakage. None was performed by this static audit.

## Browser / actual game engine acceptance

- Browser routes, round transitions, host/guest role boundaries, answer judgment, timers, score and rematch require Chrome/Playwright evidence tied to the exact source SHA and an isolated synthetic database.
- GitHub Actions uses the existing `scripts/e2e-with-db.mjs` PGlite/Playwright harness; its CI run should record seven launch-game specs: `survey-battle`, `forbidden-word`, `bluff-game`, `ranked-list`, `ordering-challenge`, `court-game`, `social-deduction`. A configured job or an earlier successful test is NOT proof a new head passed. Review the latest run's native reports for failures, skips and flaky cases before approval.
- Real humans have not played the revised Court or provisional HARD cards. An automated Chromium pass is valuable technical evidence but cannot replace group gameplay observations.

## Remaining hard blockers

Independent editorial/citation and alias review of all unverified factual items (especially 154 original Bluff items and previously identified 227 Board reference-sensitive facts); full semantic triage across all ten game formats; 180 Court case acceptance; 13 hard-card human playtests; review of 110 new Social words and session-history behavior; approved staged CSV import mapping; browser evidence at exact final SHA; separate owner release approval. **NO-GO, Draft and unmerged.**
