# Phase 5.0D-3: history navigation and category eligibility

## History policy (M10)

`src/lib/games/history-policy.ts` is the navigation policy used by the profile. It maps the ten launch slugs to their existing authenticated Host/result pages. Social uses `/social/host/:id`, Letter Network uses `/letter-network/host/:id`, and Category Board retains `/play/:id`. The other dedicated routes are preserved.

The older generic party service shares Survey, Forbidden Word, Bluff, Ranked and historical Lightning catalog slugs. The existing state-module discrimination remains required for these dedicated routes. Generic historical state retains `/play/:id`. Distinct legacy slugs and unknown slugs retain the existing generic destination. No session is converted, deleted or redirected by a mutation. Routing does not grant access: profile filtering, destination authentication and session ownership checks are unchanged.

## New selection policy (M11)

New Social words, Letter boards/questions and Survey surveys must meet all previous publication, locale/language, enabled-letter and authored-content validation requirements **and** have an active category. There is no fallback to an inactive category.

`src/lib/games/content-category.ts` locks the relevant Category rows with PostgreSQL `FOR SHARE`, reads their current `active` flag, and holds the lock until the existing gameplay transaction ends. IDs are bound, deduplicated and sorted. An admin category update conflicts with that row lock. If deactivation commits before this authoritative check, the content cannot be selected. If the selection obtains the category lock first, the admin update waits until the valid selection commits or rolls back. This defines the serialization boundary without changing command/session locks or adding locks to view/SSE paths.

- Social retains its existing selected-word lock and fresh bank read; category eligibility is then checked before creating the immutable word/alias round snapshot.
- Letter board generation discovers candidate categories, locks them and recomputes valid eligible question counts before generating the same 25-cell board. It can use remaining active categories. Question selection retains the existing pool/recent-use policy, locks and rereads the chosen authored question, validates its original requirements and category, then writes the existing question/answer snapshot. A concurrent authored/category change produces a retryable content conflict.
- Survey retains candidate validation and the selected-survey row lock. Its fresh selected-survey read must still be published, Arabic, valid and in an active category before creating each existing match snapshot. A later conflict rolls back even earlier provisional snapshots in that transaction.

## Existing matches and failure behavior

Existing Social word/alias snapshots, selected Letter question/answer snapshots and Survey match snapshots are read and judged as before. Category eligibility is never reapplied to an existing snapshot. Deactivation does not rewrite history, clear a private word, change an answer, alter scoring or stop an already-selected round.

Letter boards contain letters, not preselected question snapshots. Selecting a future cell is a **new question selection** and uses currently eligible content. If none remains for that letter, the existing exhaustion error is returned without changing the board. An already-selected question remains usable after category deactivation.

Reactivation makes still-published valid content eligible for subsequent selection. Existing START/rematch debit semantics are unchanged. All selection and initialization writes occur in their original transactions. Exhaustion or a category conflict rolls them back along with any provisional START credit debit, command receipt, stateVersion update, snapshot, score or analytic event. No migration, seed/content-bank rewrite or automatic category reactivation is introduced.

## Verification harnesses

`scripts/history-content-postgres.ts` requires isolated native PostgreSQL. Its transaction proxy pauses actual candidate queries for independent-connection deactivation races; there are no production delay hooks. It compares complete persisted session/round/use/vote/score/command/credit/wallet/game-event state before and after rejected operations. It also checks active selection, excluded content, reactivation, existing snapshots and privacy. `tests/e2e/history-content-eligibility.spec.ts` covers profile navigation and the real authenticated admin category PATCH path. Both use disposable fixtures and preserve authored production content.

The full release regression remains a separate gate. This phase does not implement M12 or later audit findings.
