# Metrics and history semantics

Counters describe durable records, not requests, refreshes or SSE connections. UTC timestamps are stored; calendar-day counters use **Asia/Riyadh (UTC+03:00)**. One dashboard metric group reads a read-only **REPEATABLE READ** snapshot: concurrent settlement yields old or committed financial totals, not half a transaction. Separate page widgets can load separately; no global simultaneous snapshot is claimed.

| Metric | Exact source/value | Window and inclusion |
|---|---|---|
| Users | User count | All retained accounts, including suspended/admin; not signup attempts. |
| Active users | Distinct valid unrevoked/unexpired AuthSession users, nonsuspended accounts | Current credential validity, not online viewers. Multiple sessions count once. |
| Created sessions | GameSession count | Lifetime all states including LOBBY/PAUSED/COMPLETED/ABANDONED and legacy. Same-session rematch is not another session. |
| Created today | GameSession.createdAt between Saudi midnight and observation time inclusive | UTC cutoff at prior21:00; never browser/server-local midnight. Terminal status does not remove creation. |
| Gross settled sales | Purchase.amountHalalas for PAID or historic REFUNDED with non-null paidAt | Lifetime gross SAR, not profit/net cash. PENDING/FAILED/CANCELED/EXPIRED/VOIDED excluded. Current refund preserves original PAID/gross. |
| Confirmed refunds | PurchaseRefund.amountHalalas sum | Lifetime separate full-refund value, independent of recovered credits/support remainder. Unique row prevents retry counting. |
| Categories | Category count | All retained active/inactive/legacy definitions, not selectable cards. |
| Authored launch content | Union Board Question(category-board only), SecretWord, LetterQuestion, SurveyQuestion, ForbiddenWordCard, BluffQuestion, RankedListQuestion, LightningQuestion, OrderingQuestion, CourtCase | All statuses, one item per survey/list/card, not per answer/entry. Generic legacy Party bank excluded. |
| Published / eligible | Published rows; eligible adds active category, Arabic language/locale where modeled, Board supported type/value and Letter enabled set | Current bank eligibility, not match content. Structural validity enforced by M14 boundaries/validator, not full rescan per metrics request. |
| Retained content allocations | Board SessionQuestion, SocialRound, LetterQuestionUse, SurveyQuestionUse, ForbiddenWordCardUse, BluffRound, RankedListUse, LightningQuestionUse, OrderingQuestionUse, CourtRound | Saved allocations/snapshots, possibly prepared before shown/scored. Abandoned allocations retained; rematch allocations independent. Not questions answered. |
| Popular games | GameSession grouped by GameType; descending count, ID tie-break | Same all-state creation semantics, historical legacy intentional. Not launch catalogue eligibility. |
| Popular categories | Allocations joined to bank item's current category association; descending count, ID tie-break | Admin reassignment changes attribution; not immutable historical category analytics. No secret payload is read/exposed. |
| Open reports | QuestionReport OPEN/REVIEWING | Current work; reason breakdown separately covers all retained reports. |
| Event counts | Controlled AnalyticsEvent names, occurredAt between now minus30×24h and now inclusive | Rolling elapsed duration, not calendar month. Game event names/timing not interchangeable completed-match statistics. Financial audit follows separate protected retention. |
| Most allocated questions | SessionQuestion grouped by questionId | Board/general older history only; label says so. Prepared allocations, not necessarily opened questions. |

No daily/weekly/monthly revenue metric is invented. Future calendar aggregates must define timezone and settlement-time basis first. Currency UI divides halalas by100; ledger deltas are game credits, not currency.

Other admin surfaces retain narrower scopes: Users shows filtered User count and each user's all-state hosted-session count/current wallet; Questions pagination counts the whole historical Question table, including legacy and all statuses; Reports pagination counts all report statuses. Pricing lists latest30 Purchases, original gross amount/status and separate confirmed-refund label, plus current Product price/credits/active and Coupon usedCount/reservedCount/maxUses. Credits lists latest15 GameCredit rows whose reason is the existing admin-grant reason, and the configured welcome count (configuration, not a historical grant total). Dedicated content managers show retained rows/options limited by their page query, not whole-bank launch capacity; content:validate supplies capacity. Admin purchase/grant/report dates explicitly use Saudi timezone. Coupon datetime input keeps its existing browser-local entry to UTC storage conversion; authoritative expiry compares UTC instants.

## Profile and history

Profile's latest30 GameSessions are one card per durable session describing its **current/latest match**. Never sum historical ScoreEvents into current scores. M10 historyHref uses actual session module/dedicated route and preserves legacy `/play`. Destination services keep ownership checks.

| Item | Interpretation |
|---|---|
| Lobby/active/paused | Saved current session; lobby implies no debit; resume/refresh/reconnect do not START again. |
| Completed | Dedicated Host/result page using saved latest result/snapshot, never mutable-bank reconstruction. |
| Abandoned | Existing terminal Host state; counted as creation, not relabeled completed win. |
| Rematch | Same card/creation timestamp; current scoreboard changes, prior snapshots/audit retained. |
| Legacy | Actual legacy route/module retained; no silent dedicated-game replacement. |
| Letter | Captured board-cell ownership per team; Team.score is not Letter authority. |
| Bluff | Current individual participant scores descending, stable position tie-break; not empty/team scores. |
| Social | Current round winner label; no outsider identity/secret/aliases/private tally in summary. |
| Other games | Persisted current Team.score ordered by team position. |
| Purchases | Latest20 Purchase records including pending/failed and original amount/credits/status; confirmed refund gets a separate label while original PAID remains; compensation remains separate audit. |
| Credit movements | Latest20 GameCredit rows, including welcome/admin/START/purchase/refund; original grants unchanged. |

Profile dates explicitly use Asia/Riyadh. M12 preserves sessions, results, snapshots, financial rows and required identities/counts; obsolete private vote/access cleanup does not change scores/cards/money. Operational metrics always describe currently retained records.

## Retry and telemetry

Callback/poll/cron use B01 and deduplicated financial events. Gross derives from Purchase; refunds from PurchaseRefund. Duplicate GameCommands return receipts without another event/score/allocation. Refresh/SSE renewal is a read. Cleanup retries cannot count new games. Court's controlled GAME_ABANDONED, PHASE_UNDONE, GAME_ENDED and FINAL_RESULTS event names now join its existing whitelist; properties are sessionId/gameSlug only, never jury choices. Each name remains its actual action, not invented cross-game equivalence.
