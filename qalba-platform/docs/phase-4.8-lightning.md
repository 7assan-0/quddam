# Phase 4.8 — البرق

Dedicated `lightning-quiz` GameType and `LIGHTNING_QUIZ` state discriminator. Existing games, including the legacy `fastest-mind` module, retain their rules and tests. Uses Qalba auth, credits, ordered teams, GameSession, GameCommand, ScoreEvent, secure TV links and the existing SSE pattern.

## Rules and phases

Two teams, persisted positions 0/1 with coral/turquoise colors. Fifteen questions selected and snapshotted at START. Neither team owns a prepared question. Host explicitly opens buzz; the first valid request serialized under the session database lock wins. Eight seconds to answer; a wrong answer or answer timeout gives the opponent one automatic five-second steal. Normal correct +2; steal correct +1; all wrong/timeouts 0. No negative scores. The host advances after each public result. After question fifteen, NEXT_QUESTION shows final scores, with an explicit tie if equal, then COMPLETE closes the match.

`LOBBY → START → READY → PREPARE_QUESTION → QUESTION_READY → OPEN_BUZZ → BUZZ_OPEN → BUZZ → TEAM_ANSWERING → CORRECT → QUESTION_RESULTS`.

`TEAM_ANSWERING → WRONG/TIMEOUT → STEAL → STEAL_CORRECT/STEAL_WRONG/TIMEOUT → QUESTION_RESULTS`.

NEXT_QUESTION either prepares the next snapshot or enters FINAL_RESULTS. PAUSED preserves the previous phase; RESUME restores it. END_GAME ends an in-progress match with its existing scores, safely disclosing the current unresolved question without awarding it. ABANDONED is terminal. REMATCH from COMPLETED keeps team IDs/names/order, resets all match state, selects fresh questions where available and is free in the same session. A new START consumes one credit exactly once.

## Buzzer authorization and fairness

Separate LightningBuzzerAccess, never a DisplayAccess permission. A 256-bit random bearer token is stored only as SHA-256. The credential includes session, match, team, TEAM_A_BUZZ or TEAM_B_BUZZ permission, expiry and revocation. One active link per team, six creates per ten minutes per team, six-hour TTL, all checked under the session lock. The migration adds a partial unique active-link index and permission/match checks. Host can revoke a link and generate another. Create links after START; pre-START links are not supported. Rematch preserves team identity and revokes previous match credentials; generate fresh QR links.

A buzzer reads only a safe controller projection and may submit BUZZ. Payload is UUID key plus expectedVersion, with bearer authorization. Team/timestamp/score fields are rejected. It cannot call Host mutations, read Host answers or use its token as TV authorization. Reconnection uses the same scoped credential; revoked/expired/cross-match credentials cannot resolve timers or retrieve data.

Buzz priority measures **server request serialization**, not physical reaction time. Network latency affects remote devices. No claim of millisecond-perfect physical fairness. The buzz-open phase is untimed; its server openedAt is retained during Undo. A disconnected device does not freeze the other team's buzzer or Host controls.

## Persistence and concurrency

GameSession FOR UPDATE surrounds authorization, command receipts, phase/version checks, buzz lock, scoring and state writes. Conditional version update and unique ScoreEvent command keys defend against duplicate mutations. Same key/semantic payload returns duplicate success; the same key used by a different actor/action returns COMMAND_KEY_REUSED. Duplicate success is authorized again, so revocation or rematch cannot be bypassed by retrying an old key. A valid losing/new-key buzz receives BUZZ_ALREADY_LOCKED before a stale-version error. Client timing claims are never considered.

The phone retains its pending command key across a network retry only while the authoritative stateVersion remains the same. Once SSE restores a later version, the next action receives a fresh key. A committed buzz with a lost HTTP response cannot accidentally reuse its prior receipt on the next question; a browser test reproduces the lost response and verifies two distinct buzz mutations and exact scoring.

LightningQuestion stores normalized unique question text, canonical answer, normalized-unique alternatives, active category, difficulty, ar-SA locale/status, optional bounded explanation and timestamps. LightningQuestionUse links one immutable snapshot to a generic GameRound, with match/index uniqueness and no repeated question in a match. START snapshots all fifteen questions before play, using secure unbiased shuffling and preferring outside the host's most recent hundred uses. Source/category locks and reread prevent concurrent admin edits from changing the snapshot. Old use records remain for historical integrity.

## Privacy

HostProjection includes only the current question answer and alternatives when a question has been prepared. It never contains future question text or answers. TVProjection exposes question/category/number, scores, phase, current winning buzzer and countdown, then the current canonical answer/explanation only at public result. BuzzerProjection has its assigned team, question number, phase, lock, countdown and scores; no question bank or answer text, even after resolution.

No projection includes private snapshots, unused question IDs, command payloads, token hashes or Undo history. SSR/RSC use these same authorized projections. Private routes use no-store/no-referrer headers. React renders content as escaped text. Host mutations require authentication/ownership, same origin, bounded strict schemas, phase and expectedVersion. Buzzer mutations require same origin and scoped token authorization. Allow-listed analytics and lastEvent contain controlled event names/internal IDs, never answer/alternative/explanation/token/client timestamp text.

A Next.js Proxy matcher covers only the new game's buzzer/display HTML routes. It checks scoped credential validity before the root loading boundary can stream HTTP 200, so invalid/revoked links return actual HTTP 404. This small preflight reads no question snapshots and performs no timer/state mutations; rendering and every REST/SSE operation still authorize independently under the session lock. Existing games are outside the matcher. Duplicate token query parameters are rejected without database access.

## Timers and Undo

Answer and steal deadlines use server milliseconds. At expiry an authorized read/SSE/command resolves the phase in a locked transaction, exactly once. A late judgment is rejected after the authoritative timeout commits. No background worker is required; if everyone is offline, the next authorized request resolves the persisted expired phase. A new steal then has five seconds from that server resolution.

Pause banks remaining milliseconds and shifts saved Undo deadlines by the paused duration on Resume. Countdown rendering uses server-time samples with monotonic client elapsed time; changing the local wall clock cannot authorize an action. Refresh restores server phase/deadline.

Pre-disclosure Undo covers unused OPEN_BUZZ, accepted BUZZ and wrong/steal transition. Undoing a wrong returns to the original absolute answer deadline, never a new eight seconds; if exhausted it immediately expires on the next authorized read. Undoing a buzz restores the original untimed buzz-open state/timestamp and no owner. History is bounded to eight frames for the current question.

After QUESTION_RESULTS reveals the answer, no Undo can return to active play. VOID_RESULT can cancel the awarded score with one compensating ScoreEvent, keep the answer/result public and mark the result voided. No replay or rescoring. VOID is unavailable if no points were awarded or it was already voided.

## UI, admin and realtime

Routes: `/lightning/new`, `/lightning/host/:id`, `/lightning/display/:id?token=…`, `/lightning/buzzer/:id?token=…`, `/admin/lightning-questions`. REST and events live under `/api/lightning/:id`; a separate buzzer endpoint and access endpoint enforce controller permissions.

Host supports fast phase-valid controls and per-team QR/copy/revoke. TV is read-only. Phones have a large button, explicit A/B name, own/opponent lock and connection state. Team ownership has text/markers as well as color. Existing Hamaasi Khaleeji tokens/components and Arabic RTL remain unchanged; new layout selectors are scoped to Lightning.

SSE projects only authorized state, updates on version changes and sends a ten-second heartbeat. The Lightning stream checks persisted state every 250ms for the short answer windows. Browser REST fallback starts only after an actual SSE error and stops on reconnection; healthy heartbeats do not show reconnect warnings. Revocation ends an existing stream and disables controls. TV access imports the platform's active-link, rate-window, TTL and completed-grace constants.

Admin create/edit/archive/search/category/difficulty/status fields reuse Qalba administration styling. Publishing requires an active category and valid question schema. The original starter bank contains 300 short Arabic prompts, twenty in each of fifteen categories. Admin edits preserve current/historical snapshots. Bulk CSV is outside this phase's requested admin scope.

## Content fact checks

Wording is independently authored. Basic sports/unit facts were checked against primary sources; no source quiz wording, question database or competitor assets were imported:

- IFAB, Law 3: https://www.theifab.com/laws/latest/the-players/
- FIBA coaches manual, basic basketball: https://assets.fiba.basketball/image/upload/documents-corporate-wabc-coaches-manual-eng.pdf
- FIVB, basic volleyball: https://www.fivb.com/volleyball/the-game/basic-rules/
- BIPM, SI base units: https://www.bipm.org/en/measurement-units/si-base-units

## Verification

The delivery report records actually executed gates and exact unit/browser results. Baseline hashes verify previous tests/game engines/migrations remain unchanged. Browser tests exercise real HTTP/database races, privacy in JSON/SSE/HTML/RSC, countdowns/reconnection/Undo, admin immutability and the target viewports. Do not treat a discovered case or a filtered run as a full-suite pass.
