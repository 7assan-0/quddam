# Quddam — Unified synthetic review candidate (17 October 2026)

**DRAFT / NO-GO: never treat this as a release candidate, production approval, human content approval, or authorization to merge.**

## Literal source composition
- Base: PR #24 integrated Night + Shillatak + existing Room source `0b51dd0092d2b4c4df4ec4bcb22318124322227a`. Its historical native PG17/Chrome PASS applies only to that old exact SHA and existing 18-cell Room.
- Common comparison base: PR #13 `ceda2b45671db560f887df836367edcb4da2788f`.
- Overlay: precisely the **44** changed file paths/blobs/modes in the comparison from common PR #13 to UI QA PR #27 `218371047b02f2d0bf308703b5ffcac1412a59df` (includes PR #16/#17/#20/#25 and the isolated UI assertion change). A comparison of the changed paths from the two candidate branches versus PR #13 found **zero identical changed file paths**, so the tree was composed without overwriting Night-specific deltas. This path-level non-overlap is not proof that behavioral integration is safe.
- The original PR #23 native revocation feature fix is inherited in PR #24's source; its later `7e929f7...` change relative to PR #24's parent changed only a CI workflow and has not been silently substituted.
- This candidate's new isolated CI jobs use exact GitHub PR HEAD and **fresh synthetic** PG17 / isolated PGlite. Their results are not inherited.
- The separate PR #28 Survey 91 review-only candidate is **not imported** and no original runtime Survey bank is modified.
- The separate PR #19 selector-parser patch is **not silently overlaid** onto the existing dependency/lockfile graph; the full security audit remains an explicit blocker, including the unresolved braces advisory.

## Scope of the two distinct evidence gates
1. Exact-head full unit/typecheck/lint/build and fresh native PG17 Night/Shillatak/revocation + real Chrome Night/Shillatak/existing Room integration, retention/restart and immutable receipts; no mocks in native/browser checks. The older existing Room proves its legacy board only.
2. On the exact same SHA, separately prove 36-cell Board UI and five-mobile PGlite beta journey, full unit/typecheck/lint/build, no retries. This isolated browser check does not replace a **native PG17 36-round full match** or actual physical-device/LAN/NAT testing.

## Explicit unresolved gates
- 96 questions/category (576) are not authored or editorially approved: current starter pool has 72 Board source rows, not 576.
- Independent native PG17 36-round match and broader load/capacity/physical-network checks required.
- Survey 91 candidate: every item/alias must receive independent human editorial review, real spoken-answer playtest, owner approval, then revised-bank synthetic import/browser evidence.
- Security PR #16/#19 full dependency audit, exception/patch review, request limits, retention and RTC decisions pending.
- The PR #27 scoped financial review failed; any new financial review on the final exact integrated SHA must pass independently.
- No Oracle/cloud resources, production data, billing activation, public staging/deployment, merge, or launch is authorized. No historical successful SHA can stand in for the new unified source.
