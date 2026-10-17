# Quddam — 38-open-PR integration decision map (read-only planning)
Reviewed 17 Oct 2026 from GitHub's then-live **38 OPEN / 38 DRAFT** PRs (#6–#43). This file does not certify every branch's current HEAD, test all conflicts, or authorize any merge; re-fetch GitHub state before execution. Main and all live DB/payment/cloud resources remain untouched. This audit branch is a review-only follow-up stacked on #30; it must NOT be merged into main by itself. Stage by *content equivalence* not by PR number.

## The hidden merge hazard
The full tested release/content spine ends at **#43** (exact head `41374d8c0fd7eca7d28f62b2c0733e2dc60f2615`). Its exact SHA passed 1,519 tests, PG17 576/18 buckets and integrated Chrome Night/Shillatak/Room, Board36. However separate lanes for Survey, board/UI refinements and security diverged. GitHub compare API, comparing each side's head against #43 head, yielded:
- #34 (seven UI refinements) **diverged**: merge base `ceda2b4567`, ahead 132 / behind 119 (counts are in the query direction, **not** proof of feature inclusion).
- #25 latest head diverged: merge base `ceda2b4567`, ahead 132 / behind 56.
- #30 Survey91 diverged: merge base `c385d7f291`, ahead 225 / behind 191.
- #37 integrated acceptance diverged: merge base `16b01b4e19`, ahead 83 / behind 2.
- #41 security diagnostics diverged: merge base `16b01b4e19`, ahead 83 / behind 4.
- #18 Lightning QA diverged: merge base `ceda2b4567`, ahead 132 / behind 46.
**Do not assume** success on #43 includes the side branch's specific changes or merge unrelated test branches blindly.

## Exact inventory and owner-review dispositions
Interpret the classifications below as *routing recommendations*, not approvals. No PR automatically closed or merged.

| PRs | Relationship / intended content | Action for a unified candidate |
| --- | --- | --- |
| #6 → #7 → #11 | Original design and foundational seven-game source remediations; #11 review-only content drafts and some real seed fixes | Trace actual inherited hunks against selected main and prospective release; selectively retain genuine source fixes, avoid importing unapproved CSVs; supersede obsolete style snapshots only after diff |
| #10 → #12 → #13 | Night MVP, invitations/highlights, Shillatak | Fundamental release dependency in #43 ancestry; independently compare missing final routes/tests before acceptance |
| #23 → #24 → #29 → #31 → #32 → #33 → #36 → #40 → #42 → #43 | Revocation, integrated Chrome, Board36/UI alignment, selector patch, mobile profile fix, 576 bank, exact-head regression, 23 editorial corrections | **Candidate spine**, last exact-head #43; retain staged draft, do not merge chain wholesale without security/content approval |
| #14 → #15 → #22 → #28 → #30 | Survey original 65 + non-imported 26, editorial candidate, scoped Chromium original-65 regression and three further question edits | Separate **review-only** lane. Current follow-up contains corrected tech-01 and 91/117 review ledgers; do not import 91 into #43 until 91 items/117 aliases and real spoken playtest approved |
| #16 → #17 → #20 → #25 | Beta blocker framework, five-phone board checks, actual 36 board, simplified UI; branch ancestry differs from candidate spine | Diff against #43; carry missing safety/Board/UI functionality selectively; rebase/sync PR25 latest SHA before deciding |
| #26 → #27 | UI diagnostic and unit/empty-state isolation siblings on PR25 | **Evidence/QA-only**, extract surviving tests/fix if not already present; do not blindly merge diagnostics branch |
| #34 → #35 | Seven additional RTL/numeral/layout fixes, then dedicated visual validation; sibling branch to later tested spine | Human inspect and integrate required #34 fixes individually, keep #35 as validation/evidence; rerun measured accessibility/Chrome on combined exact HEAD |
| #18 | Lightning 600 question eligibility, standalone acceptance | Independent content follow-up; only import after editorial and collision/engine checks. Do not infer inclusion from #43 tests |
| #8 → #9 | Experimental hosted WebRTC and nine-player auto-room branch | **Architectural hold** pending whether product truly uses this approach; do not merge experimental hosting into release by chronology |
| #19 | Isolated selector parser 7.1.6 correction based #16 | Avoid double-applying if #33 already carries equivalent vetted selector fix; compare lockfile exact hashes |
| #21 | Parallel Night invitation-revoke proposal | Compare with consolidated #23 and retain only missing tests or behavior; otherwise candidate superseded, owner decides closure |
| #37 | Sibling exact-head Board36 / eight-guest acceptance from #33 | Evidence/test lane; compare two commits vs #43 and cherry-pick unique assertions only, not duplicate runtime |
| #38 → #39 → #41 | Strict audit proof and unsuccessful Tailwind 4/latest fast-glob experiments; #41 establishes no braces in tested built/pruned runtime but full audit remains HIGH | **Security evidence only**, NOT green security approval. Preserve genuine audit gates; do not import experimental framework/forced downgrade. `audit-gate.mjs` described externally is NOT present on the cited #41 branch and exception is NOT owner-approved. |
| current follow-up | assistant's 91-row risk + 117-alias ledger and new written plan, staged on #30 | Editorial review artifact, not a beta source-bank import or independent human signoff |

## Practical sequence without a 38-PR merge train
1. **Freeze and record:** owner chooses an exact base/target, fetches current main/PR heads, creates a single disposable integration branch from main or a reviewed common ancestor. Codex computes each PR's merge-base, `git diff`, range-diff, patch-ID (or semantic equivalence), exact sources/tests, migration/seed impact, and explicit `INCLUDED / MISSING / CONFLICT / OBSOLETE / HOLD` inventory. Do not rely on title, old green badges, or PR number.
2. **Feature reconciliation:** start by preserving the demonstrated #43 functional spine, reconcile *missing nonoverlapping* source/UX/security requirements from #11/#16/#17/#20/#25/#34/#37 and other lanes. Keep #8/#9 experimental separate and avoid double implementation of #19/#33 and #21/#23. Bring the Survey reviewed CSVs only as non-runtime review artifacts until owner editorial approval; Lightning #18 likewise separately gated.
3. **Content decision:** two independent editors and actual two-group blind spoken Survey session across 91/117 (not invented); resolve 25 specifically flagged scenes, 10 flagged aliases, and rank/order weights. Separately Board576 needs 576 independent factual decisions and 30 flagged difficulty decisions. Check acceptable answers, repeat exposure and per-game character. Only then design isolated approved content import with stable IDs.
4. **Security decision:** full dependency audit currently **FAIL** on dev `braces@3.0.3` advisory GHSA-vfj7-8cjw-p6xm; production-only audit 0 and built-pruned package closure PASS do not clear full gate. Seek real upstream fix/safe compatible graph or submit a narrowly scoped independently reviewed *explicit owner-approved* time-limited risk acceptance in a **separate PR** with fail-closed tests. Do not silently replace strict audit or set success on audit error. No `--force` downgrade.
5. **One exact-head acceptance:** source-binding pre/post, npm clean install + production and full/security-exception gates as actually approved, PG17 native migrations/double idempotent seed/restore, 576 18×32, Survey revised **91** separate isolated proof after approval, full Night/Shillatak/eight-guest/Board36 Chrome (plus UI accessibility), browser host flows, mobile real-device/network sessions, scoped payments in synthetic fixtures. Never claim historical original 65 as a revised 91 test.
6. **Owner gate:** review change log, cost/security impact and run receipts; owner explicitly approves merge (one controlled branch) and later independent Oracle staging/deploy after MFA/capacity check. No silent merge/main, live DB seed, billing enable, resource purchase, public release or PR closure by this file.

## Role ownership
- **ChatGPT/GitHub:** inspect source and PR diffs, review curated content, write item/alias ledgers and conflict plan, inspect CI evidence, raise small review-only PRs, call out false coverage.
- **Codex with full checkout/build:** exact merge-base and selective integration, dependency fixes/probes, migration/refactor, full native PG17/Chrome/mobile/CI repair and code generation. Return exact SHA, diff/stat, and failed checks.
- **Owner and independent players/editors:** approval of security exception, 91/576 question judgments and blind playtests, final PR review, actual Oracle login/MFA and explicit controlled release approval.

**Present decision:** no all-38 bulk merge, no deleting drafts and no beta publication until unresolved branches are reconciled by code-level diff and hard gates resolved.
